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
import { getAttendanceSettings, isLateArrival, calculateOvertime, isWorkingDay } from "@/services/attendance-settings";
import { format, parseISO, startOfDay, endOfDay, subDays, differenceInMinutes } from "date-fns";

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

  // Group events by employee + date to pair clock-in/clock-out
  const eventsByEmployeeDate = new Map<string, HikvisionAttendanceEvent[]>();
  for (const evt of result.events) {
    const dateStr = evt.time.split("T")[0];
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

    const date = parseISO(dateStr);

    // Check if already exists
    const existing = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: startOfDay(date) },
    });

    if (existing) {
      duplicates++;
      continue;
    }

    // Sort events by time
    events.sort((a, b) => a.time.localeCompare(b.time));

    // Determine clock-in, clock-out, breaks from events
    let clockIn: Date | null = null;
    let clockOut: Date | null = null;
    const breaks: { breakOut: Date; breakIn?: Date }[] = [];
    let overtimeIn: Date | null = null;
    let overtimeOut: Date | null = null;

    for (const evt of events) {
      const evtTime = parseISO(evt.time);
      switch (evt.attendanceStatus) {
        case "checkIn":
          if (!clockIn || evtTime < clockIn) clockIn = evtTime;
          break;
        case "checkOut":
          if (!clockOut || evtTime > clockOut) clockOut = evtTime;
          break;
        case "breakOut":
          breaks.push({ breakOut: evtTime });
          break;
        case "breakIn":
          if (breaks.length > 0 && !breaks[breaks.length - 1].breakIn) {
            breaks[breaks.length - 1].breakIn = evtTime;
          }
          break;
        case "overtimeIn":
          overtimeIn = evtTime;
          break;
        case "overtimeOut":
          overtimeOut = evtTime;
          break;
      }
    }

    // If no explicit clock-in/out, use first/last event
    if (!clockIn && events.length > 0) clockIn = parseISO(events[0].time);
    if (!clockOut && events.length > 1) clockOut = parseISO(events[events.length - 1].time);

    // Calculate working metrics
    const officeStart = settings.officeStartTime; // "10:00"
    const officeEnd = settings.officeEndTime; // "18:00"

    let lateMinutes = 0;
    let earlyMinutes = 0;
    let hours = 0;
    let overtime = 0;
    let breakMinutes = 0;
    let isHalfDay = false;
    let status = "present";

    if (clockIn) {
      // Late calculation
      const lateResult = isLateArrival(settings, clockIn);
      lateMinutes = lateResult.lateMinutes;

      // Half-day check
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
      hours = Math.max(0.1, (clockOut.getTime() - clockIn.getTime()) / 3600000);
    }

    // Break duration
    for (const brk of breaks) {
      if (brk.breakIn) {
        breakMinutes += differenceInMinutes(brk.breakIn, brk.breakOut);
      }
    }

    // Check working day
    const isWeekend = !isWorkingDay(settings, date);
    const isHoliday = false; // TODO: check against Holiday model

    // Overtime calculation
    const [startH, startM] = officeStart.split(":").map(Number);
    const [endH, endM] = officeEnd.split(":").map(Number);
    const officeMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const workedMinutes = Math.round(hours * 60);

    if (settings.overtimeEnabled) {
      const otResult = calculateOvertime(workedMinutes, officeMinutes, settings, isWeekend, isHoliday);
      overtime = otResult.overtimeMinutes / 60; // Convert to hours
    }

    // Early departure
    if (clockOut) {
      const [oEndH, oEndM] = officeEnd.split(":").map(Number);
      const officeEndMinutes = oEndH * 60 + oEndM;
      const clockOutMinutes = clockOut.getHours() * 60 + clockOut.getMinutes();
      if (clockOutMinutes < officeEndMinutes) {
        earlyMinutes = officeEndMinutes - clockOutMinutes;
      }
    }

    try {
      await prisma.attendance.create({
        data: {
          workspaceId: device.workspaceId,
          employeeId: employee.id,
          date: startOfDay(date),
          clockIn: clockIn ?? undefined,
          clockOut: clockOut ?? undefined,
          status,
          hours: Math.round(hours * 100) / 100,
          overtime: Math.round(overtime * 100) / 100,
          breakMinutes,
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

      // Create break records
      for (const brk of breaks) {
        if (brk.breakIn) {
          await prisma.break.create({
            data: {
              workspaceId: device.workspaceId,
              attendanceId: "", // Will be set after attendance creation
              employeeId: employee.id,
              breakOut: brk.breakOut,
              breakIn: brk.breakIn,
              duration: differenceInMinutes(brk.breakIn, brk.breakOut),
              status: "completed",
              isPaid: settings.breakIsPaid,
            },
          });
        }
      }

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
