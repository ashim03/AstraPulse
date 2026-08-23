"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { syncHikvisionAttendanceToDatabase } from "@/services/hikvision";

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

  const today = startOfDay(new Date());
  const existing = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (existing?.clockIn) return fail("You already clocked in today");

  const now = new Date();
  await prisma.attendance.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId,
      date: today,
      clockIn: now,
      status: "present",
    },
  });
  await writeAudit({ session, action: "create", module: "attendance", description: `Clocked in at ${now.toLocaleTimeString()}` });
  revalidatePath("/attendance");
  return ok(undefined, "Clocked in");
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

  const today = startOfDay(new Date());
  const record = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (!record) return fail("You have not clocked in today");
  if (record.clockOut) return fail("You already clocked out today");

  const clockOut = new Date();
  const hours = Math.max(0.1, (clockOut.getTime() - (record.clockIn ?? clockOut).getTime()) / 3600000);
  await prisma.attendance.update({
    where: { id: record.id },
    data: { clockOut, hours: Math.round(hours * 10) / 10, status: "present" },
  });
  await writeAudit({ session, action: "edit", module: "attendance", description: `Clocked out after ${hours.toFixed(1)}h` });
  revalidatePath("/attendance");
  return ok(undefined, "Clocked out");
}

export async function attendanceAdjustAction(
  id: string,
  data: { hours: number; status: string; note?: string }
): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "edit");
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
  ip: string,
  port: number = 80,
  username: string = "admin",
  password: string = "",
  beginDate?: string,
  endDate?: string
): Promise<{ ok: boolean; message: string; imported: number; created: number; updated: number; errors: string[] }> {
  try {
    const session = await requirePerm("attendance", "create");
    const begin = beginDate ? new Date(beginDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const result = await syncHikvisionAttendanceToDatabase(ip, port, username, password, begin, end);

    await writeAudit({ session, action: "create", module: "attendance", description: `Synced Hikvision attendance from ${ip}` });

    return {
      ok: true,
      message: `Hikvision attendance synced: ${result.imported} records (${result.created} created, ${result.updated} updated)`,
      imported: result.imported,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
    };
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message || "Failed to sync Hikvision attendance",
      imported: 0,
      created: 0,
      updated: 0,
      errors: [(e as Error).message],
    };
  }
}

export async function getEmployeeAttendanceDashboardAction(
  employeeId: string,
  month?: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const session = await requireSession();
    const now = new Date();
    const targetMonth = month ? new Date(month + "-01") : now;
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, workspaceId: session.workspaceId },
      include: { department: true, position: true },
    });
    if (!employee) return fail("Employee not found");

    const today = startOfDay(now);
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