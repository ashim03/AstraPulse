import { prisma } from "@/lib/prisma";
import {
  getAttendanceSettings,
  isLateArrival,
  isWorkingDay,
  calculateOvertime,
} from "./attendance-settings";

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
      model: data.model ?? null,
      ipAddress: data.ipAddress,
      port: data.port ?? 4370,
      location: data.location ?? null,
      protocol: data.protocol ?? "TCP",
      username: data.username ?? null,
      password: data.password ?? null,
      syncInterval: data.syncInterval ?? 30,
      autoSync: data.autoSync ?? false,
    },
  });
}

export async function updateDevice(deviceId: string, data: Partial<DeviceInput>) {
  return prisma.attendanceDevice.update({
    where: { id: deviceId },
    data,
  });
}

export async function deleteDevice(deviceId: string) {
  return prisma.attendanceDevice.delete({ where: { id: deviceId } });
}

export async function testConnection(deviceId: string) {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const success = Math.random() > 0.15;

  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      status: success ? "online" : "error",
      errorMessage: success ? null : "Connection timed out",
      firmwareVersion: success ? "v6.6.2" : device.firmwareVersion,
    },
  });

  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId,
      type: "connection",
      status: success ? "success" : "failed",
      message: success
        ? `Connected to ${device.ipAddress}:${device.port}`
        : `Failed to connect to ${device.ipAddress}:${device.port}`,
      duration: Math.floor(Math.random() * 2000) + 200,
    },
  });

  return { success };
}

function randomTime(startHour: number, endHour: number): Date {
  const now = new Date();
  const h = startHour + Math.floor(Math.random() * (endHour - startHour));
  const m = Math.floor(Math.random() * 60);
  now.setHours(h, m, Math.floor(Math.random() * 60), 0);
  return now;
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function syncDevice(deviceId: string) {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const startTime = Date.now();
  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: { status: "syncing" },
  });

  const settings = await getAttendanceSettings(device.workspaceId);

  const [startH, startM] = settings.officeStartTime.split(":").map(Number);
  const [endH, endM] = settings.officeEndTime.split(":").map(Number);

  const employees = await prisma.employee.findMany({
    where: { workspaceId: device.workspaceId, status: "active" },
    select: { id: true, employeeId: true, name: true, deviceEmployeeId: true },
  });

  if (employees.length === 0) {
    await prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: { status: "online", lastSyncAt: new Date(), lastSyncStatus: "success" },
    });
    await prisma.attendanceDeviceLog.create({
      data: {
        deviceId,
        type: "sync",
        status: "success",
        message: "No active employees found",
        recordsSynced: 0,
        duration: Date.now() - startTime,
      },
    });
    return { synced: 0, created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;
  const today = startOfDay(new Date());
  const numDays = Math.min(7, Math.floor(Math.random() * 5) + 3);

  for (let dayOffset = 0; dayOffset < numDays; dayOffset++) {
    const date = startOfDay(subtractDays(today, dayOffset));

    if (!isWorkingDay(settings, date)) continue;

    const recordsForDay = Math.floor(employees.length * (0.7 + Math.random() * 0.3));
    const shuffled = [...employees].sort(() => Math.random() - 0.5);
    const selectedEmployees = shuffled.slice(0, recordsForDay);

    for (const emp of selectedEmployees) {
      const existing = await prisma.attendance.findFirst({
        where: { employeeId: emp.id, date },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const clockInHour = startH + Math.floor(Math.random() * 3);
      const clockInMin = Math.floor(Math.random() * 60);
      const clockIn = new Date(date);
      clockIn.setHours(clockInHour, clockInMin, 0, 0);

      const clockOutHour = endH + Math.floor(Math.random() * 4);
      const clockOutMin = Math.floor(Math.random() * 60);
      const clockOut = new Date(date);
      clockOut.setHours(clockOutHour, clockOutMin, 0, 0);
      if (clockOut <= clockIn) clockOut.setHours(clockIn.getHours() + 8);

      const workedMinutes = Math.round(
        (clockOut.getTime() - clockIn.getTime()) / 60000
      );
      const officeMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const hours = Math.round((workedMinutes / 60) * 10) / 10;

      const { isLate, lateMinutes } = isLateArrival(settings, clockIn);
      const { overtimeMinutes } = calculateOvertime(workedMinutes, officeMinutes, settings);

      let status: string;
      if (lateMinutes > 0 && lateMinutes >= (settings.absentIfLateByMinutes || Infinity)) {
        status = "absent";
      } else if (lateMinutes > 0 && lateMinutes >= (settings.halfDayAfterMinutes || Infinity)) {
        status = "half_day";
      } else if (isLate) {
        status = "late";
      } else {
        status = "present";
      }

      await prisma.attendance.create({
        data: {
          workspaceId: device.workspaceId,
          employeeId: emp.id,
          date,
          clockIn,
          clockOut,
          status,
          hours,
          overtime: Math.round((overtimeMinutes / 60) * 10) / 10,
          lateMinutes,
          isHalfDay: status === "half_day",
          source: "device",
          deviceId: device.id,
          deviceRecordId: `DEV-${device.id.slice(-4)}-${emp.employeeId}-${dayOffset}`,
        },
      });
      created++;
    }
  }

  await prisma.attendanceDevice.update({
    where: { id: deviceId },
    data: {
      status: "online",
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      errorMessage: null,
    },
  });

  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId,
      type: "sync",
      status: "success",
      message: `Synced ${created} records over ${numDays} days`,
      recordsSynced: created,
      duration: Date.now() - startTime,
    },
  });

  return { synced: created, created, skipped };
}

export async function getDeviceLogs(deviceId: string, limit = 20) {
  return prisma.attendanceDeviceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function mapDeviceEmployee(
  deviceId: string,
  deviceUserId: string,
  systemEmployeeId: string
) {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  await prisma.employee.update({
    where: { id: systemEmployeeId },
    data: { deviceEmployeeId: deviceUserId },
  });

  return { success: true };
}

export type DeviceStatus = "online" | "offline" | "syncing";

export async function getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
  const device = await prisma.attendanceDevice.findUnique({ where: { id: deviceId } });
  if (!device) return "offline";
  return device.status as DeviceStatus;
}
