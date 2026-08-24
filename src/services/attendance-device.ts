import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import {
  testDeviceConnection as hikTestConnection,
  fetchAttendanceEvents,
  fetchDeviceUsers,
  getDeviceStatus as hikGetStatus,
  type HikvisionDeviceConfig,
  type HikvisionAttendanceEvent,
} from "@/services/hikvision";
import { getAttendanceSettings, calculateOvertime, isWorkingDay } from "@/services/attendance-settings";
import { parseISO, endOfDay, subDays, differenceInMinutes } from "date-fns";

// ─── Nepal Time Helpers (UTC+5:45) ──────────────────────────────────────────
const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;

function toNepalTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + NPL_OFFSET_MS);
}

function nepalHours(d: Date): number { return toNepalTime(d).getUTCHours(); }
function nepalMinutes(d: Date): number { return toNepalTime(d).getUTCMinutes(); }

function nepalDateStr(utcDate: Date): string {
  const n = toNepalTime(utcDate);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

function startOfDayNepal(utcDate: Date): Date {
  const n = toNepalTime(utcDate);
  n.setUTCHours(0, 0, 0, 0);
  return new Date(n.getTime() - NPL_OFFSET_MS);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeviceInput = {
  name: string;
  model?: string;
  ipAddress: string;
  port?: number;
  location?: string;
  protocol?: string;
  username?: string;
  password?: string;
  syncInterval?: number;
  autoSync?: boolean;
};

export type SyncLogEntry = {
  id: string;
  deviceId: string;
  deviceName: string;
  type: string;
  status: string;
  message: string | null;
  recordsSynced: number;
  duration: number | null;
  createdAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDeviceConfig(device: {
  ipAddress: string;
  port: number;
  username: string | null;
  password: string | null;
}): HikvisionDeviceConfig {
  return {
    ipAddress: device.ipAddress,
    port: device.port,
    username: device.username ?? "admin",
    password: device.password ?? "",
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getDevices(workspaceId: string) {
  return prisma.attendanceDevice.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDevice(deviceId: string) {
  return prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
}

export async function createDevice(workspaceId: string, data: DeviceInput) {
  return prisma.attendanceDevice.create({
    data: {
      workspaceId,
      name: data.name,
      model: data.model,
      ipAddress: data.ipAddress,
      port: data.port ?? 80,
      location: data.location,
      protocol: data.protocol ?? "TCP",
      username: data.username,
      password: data.password,
      syncInterval: data.syncInterval ?? 30,
      autoSync: data.autoSync ?? false,
    },
  });
}

export async function updateDevice(deviceId: string, data: Partial<DeviceInput>) {
  return prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress }),
      ...(data.port !== undefined && { port: data.port }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.protocol !== undefined && { protocol: data.protocol }),
      ...(data.username !== undefined && { username: data.username }),
      ...(data.password !== undefined && { password: data.password }),
      ...(data.syncInterval !== undefined && { syncInterval: data.syncInterval }),
      ...(data.autoSync !== undefined && { autoSync: data.autoSync }),
    },
  });
}

export async function deleteDevice(deviceId: string) {
  return prisma.attendanceDevice.delete({ where: { id: deviceId } });
}

// ─── Device Operations ───────────────────────────────────────────────────────

export async function testConnection(deviceId: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const config = toDeviceConfig(device);
  const result = await hikTestConnection(config);

  // Update device status
  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      status: result.success ? "online" : "error",
      errorMessage: result.error ?? null,
      firmwareVersion: result.deviceInfo?.firmwareVersion ?? device.firmwareVersion,
      serialNumber: result.deviceInfo?.serialNumber ?? device.serialNumber,
      model: result.deviceInfo?.model ?? device.model,
    },
  });

  // Log the connection test
  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId,
      type: "connection",
      status: result.success ? "success" : "failed",
      message: result.success
        ? `Connected successfully (${result.latencyMs}ms). Model: ${result.deviceInfo?.model}, FW: ${result.deviceInfo?.firmwareVersion}`
        : result.error ?? "Connection failed",
    },
  });

  return { success: result.success, message: result.error ?? "Connected", latencyMs: result.latencyMs };
}

export async function getDeviceStatus(deviceId: string): Promise<"online" | "offline" | "syncing" | "error"> {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) return "offline";

  const status = await hikGetStatus(toDeviceConfig(device));
  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: { status },
  });
  return status;
}

export async function fetchDeviceUserList(deviceId: string): Promise<{ employeeNo: string; name: string }[]> {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  return fetchDeviceUsers(toDeviceConfig(device));
}

// ─── Sync Engine ─────────────────────────────────────────────────────────────

export async function syncDevice(deviceId: string): Promise<{
  success: boolean;
  recordsRetrieved: number;
  newRecords: number;
  duplicates: number;
  unmapped: number;
  failed: number;
  message: string;
}> {
  const startTime = Date.now();
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const config = toDeviceConfig(device);
  const settings = await getAttendanceSettings(device.workspaceId);

  // Mark as syncing
  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: { status: "syncing", lastSyncStatus: null, errorMessage: null },
  });

  // Determine sync window: use lastSyncTime for incremental, or last 30 days for initial
  const now = new Date();
  const endTime = endOfDay(now);
  const startTimeWindow = device.lastSyncAt
    ? subDays(device.lastSyncAt, 1) // Sync 1 day before last sync to handle clock skew
    : subDays(now, 30); // Initial sync: last 30 days

  // Fetch events from device
  const result = await fetchAttendanceEvents(config, startTimeWindow, endTime, device.lastSyncAt ?? undefined);

  if (!result.success) {
    await prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: { status: "error", errorMessage: result.error },
    });
    await prisma.attendanceDeviceLog.create({
      data: {
        deviceId,
        type: "sync",
        status: "failed",
        message: result.error,
        duration: Date.now() - startTime,
      },
    });
    return {
      success: false,
      recordsRetrieved: 0,
      newRecords: 0,
      duplicates: 0,
      unmapped: 0,
      failed: 0,
      message: result.error ?? "Sync failed",
    };
  }

  // Load all employees with deviceEmployeeId for this workspace
  const employees = await prisma.employee.findMany({
    where: { workspaceId: device.workspaceId, status: "active" },
    select: { id: true, employeeId: true, name: true, deviceEmployeeId: true },
  });

  // Build device user → employee mapping
  const deviceUserMap = new Map<string, typeof employees[0]>();
  for (const emp of employees) {
    if (emp.deviceEmployeeId) {
      deviceUserMap.set(emp.deviceEmployeeId, emp);
    }
  }

  let newRecords = 0;
  let duplicates = 0;
  let unmapped = 0;
  let failed = 0;

  // Group events by employee + Nepal date to pair clock-in/clock-out
  const eventsByEmployeeDate = new Map<string, HikvisionAttendanceEvent[]>();
  for (const evt of result.events) {
    if (!evt.employeeNo) { unmapped++; continue; }
    const evtTime = parseISO(evt.time);
    const dateStr = nepalDateStr(evtTime);
    const key = `${evt.employeeNo}:${dateStr}`;
    if (!eventsByEmployeeDate.has(key)) {
      eventsByEmployeeDate.set(key, []);
    }
    eventsByEmployeeDate.get(key)!.push(evt);
  }

  // Process each employee-date group
  for (const [key, events] of Array.from(eventsByEmployeeDate.entries())) {
    const [deviceUserId, dateStr] = key.split(":");
    const employee = deviceUserMap.get(deviceUserId);

    if (!employee) {
      unmapped++;
      continue;
    }

    // Parse date using Nepal date string for grouping
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dateUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

    // Check if already exists
    const existing = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: dateUtc },
    });

    if (existing) {
      duplicates++;
      continue;
    }

    // Sort events by time
    events.sort((a, b) => a.time.localeCompare(b.time));

    // Parse all event times
    const parsedEvents = events.map(evt => ({ ...evt, parsedTime: parseISO(evt.time) }));

    // First event = clockIn, last event = clockOut (device doesn't distinguish)
    const clockIn = parsedEvents[0].parsedTime;
    const clockOut = parsedEvents.length > 1 ? parsedEvents[parsedEvents.length - 1].parsedTime : null;

    // Calculate metrics using Nepal time
    const [oh, om] = settings.officeStartTime.split(":").map(Number);
    const [oeh, oem] = settings.officeEndTime.split(":").map(Number);
    const officeStartMinutes = oh * 60 + om;
    const officeEndMinutes = oeh * 60 + oem;

    let lateMinutes = 0;
    let earlyMinutes = 0;
    let hours = 0;
    let overtime = 0;
    let isHalfDay = false;
    let status = "present";

    if (clockIn) {
      const clockInNplMin = nepalHours(clockIn) * 60 + nepalMinutes(clockIn);
      lateMinutes = Math.max(0, clockInNplMin - officeStartMinutes - settings.graceMinutes);

      if (settings.absentIfLateByMinutes > 0 && lateMinutes >= settings.absentIfLateByMinutes) {
        status = "absent";
      } else if (settings.halfDayAfterMinutes > 0 && lateMinutes >= settings.halfDayAfterMinutes) {
        isHalfDay = true;
        status = "half_day";
      } else if (lateMinutes > 0) {
        status = "late";
      } else {
        status = "present";
      }
    }

    // Working hours
    if (clockIn && clockOut) {
      hours = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3600000);
    }

    // Early departure
    if (clockOut) {
      const clockOutNplMin = nepalHours(clockOut) * 60 + nepalMinutes(clockOut);
      if (clockOutNplMin < officeEndMinutes) {
        earlyMinutes = officeEndMinutes - clockOutNplMin;
      }
    }

    // Overtime calculation
    const officeMinutes = officeEndMinutes - officeStartMinutes;
    const workedMinutes = Math.round(hours * 60);
    const isWeekend = !isWorkingDay(settings, dateUtc);
    const isHoliday = false;

    if (settings.overtimeEnabled) {
      const otResult = calculateOvertime(workedMinutes, officeMinutes, settings, isWeekend, isHoliday);
      overtime = otResult.overtimeMinutes / 60;
    }

    try {
      await prisma.attendance.create({
        data: {
          workspaceId: device.workspaceId,
          employeeId: employee.id,
          date: dateUtc,
          clockIn,
          clockOut,
          status,
          hours: Math.round(hours * 100) / 100,
          overtime: Math.round(overtime * 100) / 100,
          breakMinutes: 0,
          lateMinutes,
          earlyMinutes,
          isHalfDay,
          isHoliday,
          isWeekend,
          source: "device",
          deviceId: device.id,
          deviceRecordId: `HIK-${deviceUserId}-${dateStr}-${events.length}`,
        },
      });

      newRecords++;
    } catch (e) {
      failed++;
    }
  }

  // Update device sync status
  const duration = Date.now() - startTime;
  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      status: "online",
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      errorMessage: null,
    },
  });

  // Create sync log
  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId,
      type: "sync",
      status: failed > 0 ? "warning" : "success",
      message: `Retrieved ${result.numOfMatches} events. New: ${newRecords}, Duplicates: ${duplicates}, Unmapped: ${unmapped}, Failed: ${failed}`,
      recordsSynced: newRecords,
      duration,
    },
  });

  return {
    success: true,
    recordsRetrieved: result.numOfMatches,
    newRecords,
    duplicates,
    unmapped,
    failed,
    message: `Sync complete: ${newRecords} new, ${duplicates} duplicates, ${unmapped} unmapped`,
  };
}

// ─── Employee-Device Mapping ─────────────────────────────────────────────────

export async function mapDeviceEmployee(
  employeeId: string,
  deviceUserId: string
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: { deviceEmployeeId: deviceUserId },
  });
}

export async function getUnmappedEmployees(workspaceId: string) {
  return prisma.employee.findMany({
    where: { workspaceId, status: "active", deviceEmployeeId: null },
    select: { id: true, employeeId: true, name: true, department: { select: { name: true } } },
  });
}

export async function getMappedEmployees(workspaceId: string) {
  return prisma.employee.findMany({
    where: { workspaceId, status: "active", deviceEmployeeId: { not: null } },
    select: { id: true, employeeId: true, name: true, deviceEmployeeId: true, department: { select: { name: true } } },
  });
}

// ─── Device Logs ─────────────────────────────────────────────────────────────

export async function getDeviceLogs(deviceId: string, limit = 20): Promise<SyncLogEntry[]> {
  const logs = await prisma.attendanceDeviceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });

  return logs.map((log) => ({
    ...log,
    deviceName: device?.name ?? "Unknown",
  }));
}

// ─── Device Permission ───────────────────────────────────────────────────────

export function checkDevicePermission(session: SessionUser): boolean {
  return hasPermission(session, "attendance", "device");
}
