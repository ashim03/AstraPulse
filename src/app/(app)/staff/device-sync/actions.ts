"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "crypto";
import http from "http";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  syncEmployeeToDevice,
  retryFailedSyncs,
  getDeviceSyncStatus,
  type DeviceSyncResult,
} from "@/services/device-sync";
import { syncDevice } from "@/services/attendance-device";

export type ActionResponse = {
  success: boolean;
  message: string;
};

/**
 * Sync a single employee to the attendance device.
 */
export async function syncSingleEmployee(employeeId: string): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId, workspaceId: session.workspaceId },
    select: { id: true, employeeId: true, name: true },
  });

  if (!employee) {
    return { success: false, message: "Employee not found" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found. Configure a device first." };
  }

  const result = await syncEmployeeToDevice(employee, device.id);
  revalidatePath("/staff/device-sync");
  return result;
}

/**
 * Sync all active employees to the attendance device.
 */
export async function syncAllEmployees(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const result = await retryFailedSyncs(session.workspaceId);
  revalidatePath("/staff/device-sync");
  return result;
}

/**
 * Retry only failed syncs (employees without deviceEmployeeId).
 */
export async function retryFailed(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const employees = await prisma.employee.findMany({
    where: {
      workspaceId: session.workspaceId,
      deviceEmployeeId: null,
      status: "active",
    },
  });

  if (employees.length === 0) {
    return { success: true, message: "No failed syncs to retry" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found" };
  }

  let synced = 0;
  let failed = 0;

  for (const emp of employees) {
    const result = await syncEmployeeToDevice(
      { id: emp.id, employeeId: emp.employeeId, name: emp.name },
      device.id,
    );
    if (result.success) synced++;
    else failed++;
  }

  revalidatePath("/staff/device-sync");
  return {
    success: failed === 0,
    message: `Retried: ${synced}/${employees.length} synced (${failed} failed)`,
  };
}

/**
 * Pull attendance records from the device (manual trigger).
 * Uses raw http module (same approach as device-poller.js) to avoid fetch() Digest auth issues.
 */
export async function pullAttendance(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found" };
  }

  const startTime = Date.now();

  try {
    const ip = device.ipAddress;
    const port = device.port;
    const user = device.username || "admin";
    const pass = device.password || "";

    const httpReq = (path: string, headers: Record<string, string>, method: string, body?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> => {
      return new Promise((resolve, reject) => {
        const opts: http.RequestOptions = { hostname: ip, port, path, headers: headers || {}, method: method || "GET", timeout: 15000 };
        const req = http.request(opts, (res) => {
          let data = "";
          res.on("data", (c: Buffer) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Connection timed out")); });
        if (body) req.write(body);
        req.end();
      });
    }

    const md5 = (s: string): string => createHash("md5").update(s).digest("hex");

    const digestPost = async (path: string, body: string): Promise<{ status: number; body: string }> => {
      const initHeaders: Record<string, string> = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() };
      const r0 = await httpReq(path, initHeaders, "POST", body);
      if (r0.status === 200) return r0;
      const wwwAuth = r0.headers["www-authenticate"] as string;
      if (!wwwAuth || !wwwAuth.includes("Digest")) return r0;
      const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || "";
      const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || "";
      const qopMatch = wwwAuth.match(/qop="([^"]+)"/);
      const qop = qopMatch ? qopMatch[1] : "auth";
      const nc = "00000001";
      const cnonce = randomBytes(8).toString("hex");
      const ha1 = md5(user + ":" + realm + ":" + pass);
      const ha2 = md5("POST:" + path);
      const response = md5(ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + ha2);
      const authHeader = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
      const authHeaders: Record<string, string> = { Authorization: authHeader, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString() };
      return httpReq(path, authHeaders, "POST", body);
    }

    // Fetch ALL events from device (last 7 days) with pagination
    const now = new Date();
    const lookback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmtTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "");

    let allEvents: any[] = [];
    let position = 0;
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      const body = JSON.stringify({
        AcsEventCond: {
          searchID: `manual-${Date.now()}`,
          searchResultPosition: position,
          maxResults,
          major: 5,
          minor: 0,
          startTime: fmtTime(lookback),
          endTime: fmtTime(now),
        },
      });

      const r = await digestPost("/ISAPI/AccessControl/AcsEvent?format=json", body);
      if (r.status !== 200) {
        throw new Error(`Device returned status ${r.status}`);
      }

      const data = JSON.parse(r.body);
      const events = data?.AcsEvent?.InfoList ?? [];
      const totalMatches = data?.AcsEvent?.totalMatches ?? 0;
      allEvents = allEvents.concat(events);
      position += events.length;
      hasMore = events.length > 0 && position < totalMatches;
    }

    // Load employees with deviceEmployeeId
    const employees = await prisma.employee.findMany({
      where: { workspaceId: session.workspaceId, status: "active" },
      select: { id: true, employeeId: true, name: true, deviceEmployeeId: true },
    });

    const empMap: Record<string, typeof employees[0]> = {};
    for (const emp of employees) {
      if (emp.deviceEmployeeId) empMap[emp.deviceEmployeeId] = emp;
    }

    // Group by employee + Nepal date
    const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;
    const grouped: Record<string, any[]> = {};
    for (const evt of allEvents) {
      const empNo = evt.employeeNoString ?? evt.employeeNo ?? "";
      if (!empNo) continue;
      const evtDate = new Date(evt.time);
      const nplDate = new Date(evtDate.getTime() + NPL_OFFSET_MS);
      const dateStr = `${nplDate.getUTCFullYear()}-${String(nplDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nplDate.getUTCDate()).padStart(2, "0")}`;
      const key = `${empNo}:${dateStr}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(evt);
    }

    let newRecords = 0;
    let duplicates = 0;
    let unmapped = 0;

    for (const [key, events] of Object.entries(grouped)) {
      const [deviceUserId, dateStr] = key.split(":");
      const employee = empMap[deviceUserId];
      if (!employee) { unmapped++; continue; }

      const [y, mo, d] = dateStr.split("-").map(Number);
      const dateUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

      const existing = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: dateUtc },
      });
      if (existing) { duplicates++; continue; }

      events.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));

      const clockIn = new Date(events[0].time);
      const clockOut = events.length > 1 ? new Date(events[events.length - 1].time) : null;

      const OFFICE_START_MIN = 9 * 60 + 30;
      const GRACE_DEADLINE = OFFICE_START_MIN + 10;
      const OT_THRESHOLD = 17 * 60 + 35;

      let lateMinutes = 0;
      let status = "present";
      if (clockIn) {
        const clockInNplMin = (new Date(clockIn.getTime() + NPL_OFFSET_MS)).getUTCHours() * 60 + (new Date(clockIn.getTime() + NPL_OFFSET_MS)).getUTCMinutes();
        if (clockInNplMin <= GRACE_DEADLINE) {
          status = "present";
          lateMinutes = Math.max(0, clockInNplMin - OFFICE_START_MIN);
        } else {
          status = "absent";
          lateMinutes = clockInNplMin - OFFICE_START_MIN;
        }
      }

      let hours = 0;
      let overtime = 0;
      let earlyMinutes = 0;
      if (clockIn && clockOut) {
        const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / 60000;
        hours = Math.max(0, totalMinutes / 60);
        const clockOutNplMin = (new Date(clockOut.getTime() + NPL_OFFSET_MS)).getUTCHours() * 60 + (new Date(clockOut.getTime() + NPL_OFFSET_MS)).getUTCMinutes();
        earlyMinutes = Math.max(0, 17 * 60 + 30 - clockOutNplMin);
        overtime = Math.max(0, clockOutNplMin - OT_THRESHOLD) / 60;
      }

      await prisma.attendance.create({
        data: {
          workspaceId: session.workspaceId,
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
          isHalfDay: false,
          isHoliday: false,
          isWeekend: false,
          source: "device",
          deviceId: device.id,
          deviceRecordId: `HIK-${deviceUserId}-${dateStr}-${events.length}`,
        },
      });
      newRecords++;
    }

    // Update device sync status
    await prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { status: "online", lastSyncAt: new Date(), lastSyncStatus: "success", errorMessage: null },
    });

    await prisma.attendanceDeviceLog.create({
      data: {
        deviceId: device.id,
        type: "sync",
        status: "success",
        message: `Manual pull: ${allEvents.length} events, ${newRecords} new, ${duplicates} duplicates, ${unmapped} unmapped`,
        recordsSynced: newRecords,
        duration: Date.now() - startTime,
      },
    });

    revalidatePath("/staff/device-sync");
    revalidatePath("/attendance");
    return {
      success: true,
      message: `Pulled ${allEvents.length} events: ${newRecords} new, ${duplicates} duplicates, ${unmapped} unmapped`,
    };
  } catch (e: any) {
    await prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { status: "error", errorMessage: e.message },
    });
    await prisma.attendanceDeviceLog.create({
      data: {
        deviceId: device.id,
        type: "sync",
        status: "failed",
        message: e.message,
        duration: Date.now() - startTime,
      },
    });
    revalidatePath("/staff/device-sync");
    return { success: false, message: `Pull failed: ${e.message}` };
  }
}

/**
 * Get device sync overview data for the page.
 */
export async function getDeviceSyncData() {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return null;
  }

  const [device, employees, syncStatuses, logs] = await Promise.all([
    prisma.attendanceDevice.findFirst({
      where: { workspaceId: session.workspaceId, isActive: true },
    }),
    prisma.employee.findMany({
      where: { workspaceId: session.workspaceId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
        deviceEmployeeId: true,
      },
      orderBy: { employeeId: "asc" },
    }),
    getDeviceSyncStatus(session.workspaceId),
    prisma.attendanceDeviceLog.findMany({
      where: {
        device: { workspaceId: session.workspaceId },
      },
      include: { device: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const failedSyncLogs = await prisma.attendanceDeviceLog.count({
    where: {
      device: { workspaceId: session.workspaceId },
      status: "failed",
    },
  });

  const deviceOnline = device?.status === "online";

  return {
    device,
    employees,
    syncStatuses,
    logs,
    deviceOnline,
    failedSyncLogs,
  };
}
