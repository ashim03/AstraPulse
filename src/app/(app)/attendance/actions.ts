"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, canAccessEmployee, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { syncDevice, getDevices } from "@/services/attendance-device";
import {
  determineCheckInStatus,
  determineCheckOutStatus,
  calculateWorkingHours,
  canStartBreak,
  validateBreakDuration,
  ATTENDANCE_CONSTANTS,
} from "@/services/attendance-settings";

// ─── Nepal Time Helpers ───────────────────────────────────────────────────────
const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;
function toNepalTime(d: Date): Date { return new Date(d.getTime() + NPL_OFFSET_MS); }
function nepalStartOfDay(): Date {
  const npl = toNepalTime(new Date());
  const y = npl.getUTCFullYear();
  const m = npl.getUTCMonth();
  const d = npl.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0));
}

async function requirePerm(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function clockInAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("attendance", "create");
  } catch {
    return fail("You don't have permission");
  }
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = nepalStartOfDay();
  const existing = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (existing?.clockIn) return fail("You already clocked in today");

  const now = new Date();
  const settings = await prisma.attendanceSettings.findFirst({
    where: { workspaceId: session.workspaceId },
  }) || { officeStartTime: "09:30", graceMinutes: 10, absentIfLateByMinutes: 10 };

  // Determine status using Nepal time rules
  const statusResult = determineCheckInStatus(settings, now);

  await prisma.attendance.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId,
      date: today,
      clockIn: now,
      status: statusResult.status,
      lateMinutes: statusResult.lateMinutes,
    },
  });

  const timeStr = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });
  await writeAudit({ session, action: "create", module: "attendance", description: `Clocked in at ${timeStr} — ${statusResult.status}` });
  revalidatePath("/attendance");

  if (statusResult.isAbsent) {
    return ok(undefined, `Clocked in at ${timeStr} — marked ABSENT (after ${ATTENDANCE_CONSTANTS.GRACE_PERIOD_END} grace period)`);
  }
  return ok(undefined, `Clocked in at ${timeStr} — Present`);
}

export async function clockOutAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("attendance", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = nepalStartOfDay();
  const record = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (!record) return fail("You have not clocked in today");
  if (record.clockOut) return fail("You already clocked out today");

  const clockOut = new Date();
  const settings = await prisma.attendanceSettings.findFirst({
    where: { workspaceId: session.workspaceId },
  }) || { officeEndTime: "17:30" };

  const checkOutResult = determineCheckOutStatus(settings, clockOut);
  const breakMinutes = record.breakMinutes ?? 0;
  const hours = calculateWorkingHours(record.clockIn ?? clockOut, clockOut, breakMinutes);

  await prisma.attendance.update({
    where: { id: record.id },
    data: {
      clockOut,
      hours,
      overtime: checkOutResult.overtimeMinutes / 60,
      earlyMinutes: checkOutResult.earlyMinutes,
      status: record.status === "absent" ? record.status : "present",
    },
  });

  const timeStr = clockOut.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });
  let msg = `Clocked out at ${timeStr} — ${hours.toFixed(1)}h worked`;
  if (checkOutResult.isOvertime) msg += `, ${checkOutResult.overtimeMinutes}min overtime`;
  if (checkOutResult.isEarlyDeparture) msg += `, ${checkOutResult.earlyMinutes}min early`;

  await writeAudit({ session, action: "edit", module: "attendance", description: msg });
  revalidatePath("/attendance");
  return ok(undefined, msg);
}

// ─── Break Actions ────────────────────────────────────────────────────────────

export async function startBreakAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("attendance", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = nepalStartOfDay();
  const record = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (!record) return fail("You must clock in before starting a break");
  if (record.clockOut) return fail("Cannot start a break after clocking out");

  // Check if break already used today
  const existingBreaksToday = await prisma.break.findMany({
    where: { workspaceId: session.workspaceId, employeeId, attendanceId: record.id },
  });

  const settings = await prisma.attendanceSettings.findFirst({
    where: { workspaceId: session.workspaceId },
  }) || { breakEnabled: true, maxBreaksPerDay: 1 };

  const validation = canStartBreak(existingBreaksToday.length, new Date(), settings);
  if (!validation.allowed) return fail(validation.reason!);

  const breakRecord = await prisma.break.create({
    data: {
      workspaceId: session.workspaceId,
      attendanceId: record.id,
      employeeId,
      breakOut: new Date(),
      status: "active",
      isPaid: false,
    },
  });

  const timeStr = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });
  await writeAudit({ session, action: "create", module: "attendance", description: `Break started at ${timeStr}` });
  revalidatePath("/attendance");
  return ok(undefined, `Break started at ${timeStr}`);
}

export async function endBreakAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("attendance", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = nepalStartOfDay();
  const record = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (!record) return fail("No attendance record found");

  // Find active break
  const activeBreak = await prisma.break.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, attendanceId: record.id, status: "active" },
  });
  if (!activeBreak) return fail("No active break found");

  const breakIn = new Date();
  const durationMs = breakIn.getTime() - activeBreak.breakOut.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Validate max 35 minutes
  const validation = validateBreakDuration(breakIn, activeBreak.breakOut);
  if (!validation.allowed) {
    // Still close the break but mark as exceeded
    await prisma.break.update({
      where: { id: activeBreak.id },
      data: { breakIn, duration: durationMinutes, status: "exceeded" },
    });
    await prisma.attendance.update({
      where: { id: record.id },
      data: { breakMinutes: record.breakMinutes + durationMinutes },
    });
    revalidatePath("/attendance");
    return fail(validation.reason!);
  }

  await prisma.break.update({
    where: { id: activeBreak.id },
    data: { breakIn, duration: durationMinutes, status: "completed" },
  });

  // Update total break minutes on attendance
  const allBreaks = await prisma.break.findMany({
    where: { workspaceId: session.workspaceId, employeeId, attendanceId: record.id, status: "completed" },
  });
  const totalBreakMinutes = allBreaks.reduce((sum, b) => sum + (b.duration ?? 0), 0) + durationMinutes;
  await prisma.attendance.update({
    where: { id: record.id },
    data: { breakMinutes: totalBreakMinutes },
  });

  const timeStr = breakIn.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });
  await writeAudit({ session, action: "edit", module: "attendance", description: `Break ended at ${timeStr} — ${durationMinutes}min (max 35min)` });
  revalidatePath("/attendance");
  return ok(undefined, `Break ended at ${timeStr} — ${durationMinutes} minutes used`);
}

export async function attendanceAdjustAction(
  id: string,
  data: { hours: number; status: string; note?: string }
): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "manage");
    const record = await prisma.attendance.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!record) return fail("Record not found");
    await prisma.attendance.update({
      where: { id },
      data: { hours: data.hours, status: data.status as never, note: data.note || null },
    });
    await writeAudit({ session, action: "edit", module: "attendance", recordId: id, description: `Adjusted attendance record` });
    revalidatePath("/attendance");
    return ok(undefined, "Record updated");
  } catch (e) {
    return fail("Failed to update attendance record. Please try again.");
  }
}

export async function syncHikvisionAttendanceAction(
  deviceId: string
): Promise<{ ok: boolean; message: string; recordsRetrieved: number; newRecords: number; duplicates: number; unmapped: number; failed: number }> {
  try {
    const session = await requirePerm("attendance", "device");
    const result = await syncDevice(deviceId);

    await writeAudit({ session, action: "create", module: "attendance", description: `Synced device ${deviceId}: ${result.newRecords} new records` });

    return {
      ok: result.success,
      message: result.message,
      recordsRetrieved: result.recordsRetrieved,
      newRecords: result.newRecords,
      duplicates: result.duplicates,
      unmapped: result.unmapped,
      failed: result.failed,
    };
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message || "Failed to sync device",
      recordsRetrieved: 0,
      newRecords: 0,
      duplicates: 0,
      unmapped: 0,
      failed: 0,
    };
  }
}

export async function getEmployeeAttendanceDashboardAction(
  employeeId: string,
  month?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const session = await requireSession();
    if (!hasPermission(session, "attendance", "view")) {
      await writeAudit({ session, action: "denied", module: "attendance", description: "Permission denied: attendance:view" });
      return fail("You don't have permission to view attendance");
    }
    const now = new Date();
    const targetMonth = month ? new Date(month + "-01") : now;
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, workspaceId: session.workspaceId },
      include: { department: true, position: true },
    });
    if (!employee) return fail("Employee not found");
    if (!canAccessEmployee(session, employeeId, employee.departmentId)) {
      await writeAudit({ session, action: "denied", module: "attendance", recordId: employeeId, description: "Permission denied: cannot access employee attendance data" });
      return fail("You don't have access to this employee's data");
    }

    const today = nepalStartOfDay();
    const [todayRecord, monthlyRecords, breaks, overtimeRecords] = await Promise.all([
      prisma.attendance.findFirst({
        where: { workspaceId: session.workspaceId, employeeId, date: today },
      }),
      prisma.attendance.findMany({
        where: {
          workspaceId: session.workspaceId,
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: "asc" },
      }),
      prisma.break.findMany({
        where: {
          workspaceId: session.workspaceId,
          employeeId,
          attendance: { date: { gte: monthStart, lte: monthEnd } },
        },
        orderBy: { breakOut: "desc" },
      }),
      prisma.overtimeRecord.findMany({
        where: {
          workspaceId: session.workspaceId,
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    const totalDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    const present = monthlyRecords.filter((r) => r.status === "present").length;
    const absent = monthlyRecords.filter((r) => r.status === "absent").length;
    const halfDays = monthlyRecords.filter((r) => r.isHalfDay).length;
    const leave = monthlyRecords.filter((r) => r.status === "leave").length;
    const late = monthlyRecords.filter((r) => r.lateMinutes > 0).length;
    const overtime = monthlyRecords.filter((r) => r.overtime > 0).length;
    const attendancePct = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

    const dailyData = monthlyRecords.map((r) => ({
      date: format(r.date, "yyyy-MM-dd"),
      status: r.status,
      hours: r.hours,
      clockIn: r.clockIn?.toISOString() || null,
      clockOut: r.clockOut?.toISOString() || null,
      isHalfDay: r.isHalfDay,
      lateMinutes: r.lateMinutes,
      overtime: r.overtime,
      breakMinutes: r.breakMinutes,
    }));

    return ok<Record<string, unknown>>({
      employee,
      todayRecord,
      monthlyRecords,
      dailyData,
      breaks,
      overtimeRecords,
      stats: {
        totalDays,
        present,
        absent,
        halfDays,
        leave,
        late,
        overtime,
        attendancePct,
      },
    });
  } catch (e) {
    return fail("Failed to load attendance dashboard: " + (e as Error).message);
  }
}

export async function getAttendanceReportAction(
  reportType: string,
  startDate: string,
  endDate: string,
  filters: { department?: string; employeeId?: string; status?: string } = {}
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const session = await requireSession();
    if (!hasPermission(session, "attendance", "reports")) {
      await writeAudit({ session, action: "denied", module: "attendance", description: "Permission denied: attendance:reports" });
      return fail("You don't have permission to view attendance reports");
    }
    const start = new Date(startDate);
    const end = new Date(endDate);

    const where: Record<string, unknown> = {
      workspaceId: session.workspaceId,
      date: { gte: start, lte: end },
    };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.department) {
      where.employee = { departmentId: filters.department };
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { include: { department: true, position: true } } },
      orderBy: { date: "desc" },
    });

    let filteredRecords = records;
    if (reportType === "late") {
      filteredRecords = records.filter((r) => r.lateMinutes > 0);
    } else if (reportType === "absent") {
      filteredRecords = records.filter((r) => r.status === "absent");
    } else if (reportType === "overtime") {
      filteredRecords = records.filter((r) => r.overtime > 0);
    } else if (reportType === "hours") {
      filteredRecords = records.filter((r) => r.hours > 0);
    }

    const allEmployees = await prisma.employee.findMany({
      where: { workspaceId: session.workspaceId, status: "active" },
      include: { department: true },
    });
    const presentCount = filteredRecords.filter((r) => r.status === "present").length;
    const absentCount = filteredRecords.filter((r) => r.status === "absent").length;
    const lateCount = filteredRecords.filter((r) => r.lateMinutes > 0).length;
    const overtimeCount = filteredRecords.filter((r) => r.overtime > 0).length;
    const avgHours = filteredRecords.length > 0
      ? filteredRecords.reduce((sum, r) => sum + r.hours, 0) / filteredRecords.length
      : 0;

    return ok<Record<string, unknown>>({
      records: filteredRecords,
      stats: {
        total: filteredRecords.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        overtime: overtimeCount,
        avgHours: Math.round(avgHours * 10) / 10,
      },
      employees: allEmployees,
    });
  } catch (e) {
    return fail("Failed to generate report: " + (e as Error).message);
  }
}