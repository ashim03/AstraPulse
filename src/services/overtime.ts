import { prisma } from "@/lib/prisma";
import type { Attendance, AttendanceSettings, OvertimeRecord } from "@prisma/client";

export type OvertimeSummary = {
  totalHours: number;
  regularHours: number;
  weekendHours: number;
  holidayHours: number;
  approvedHours: number;
  pendingHours: number;
  totalPay: number;
};

export async function calculateDailyOvertime(
  attendance: Attendance,
  settings: AttendanceSettings | null,
  baseSalary: number
): Promise<OvertimeRecord | null> {
  if (!settings || !settings.overtimeEnabled) {
    return null;
  }

  if (!attendance.clockIn || !attendance.clockOut) {
    return null;
  }

  const officeStart = parseOfficeMinutes(settings.officeStartTime);
  const officeEnd = parseOfficeMinutes(settings.officeEndTime);
  const officeMinutes = officeEnd - officeStart;
  const officeHours = officeMinutes / 60;

  const workedMinutes = (attendance.clockOut.getTime() - attendance.clockIn.getTime()) / (1000 * 60);
  const workedHours = workedMinutes / 60;

  if (workedHours <= officeHours) {
    return null;
  }

  let overtimeHours = workedHours - officeHours;
  let type = "regular";
  let rate = settings.overtimeRateMultiplier;

  if (attendance.isWeekend) {
    type = "weekend";
    rate = settings.weekendOvertimeRate;
  } else if (attendance.isHoliday) {
    type = "holiday";
    rate = settings.holidayOvertimeRate;
  }

  if (settings.overtimeRequiresApproval) {
    const existing = await prisma.overtimeRecord.findFirst({
      where: {
        employeeId: attendance.employeeId,
        date: attendance.date,
      },
    });

    if (existing) {
      return prisma.overtimeRecord.update({
        where: { id: existing.id },
        data: {
          hours: Math.round(overtimeHours * 100) / 100,
          type,
          rate,
        },
      });
    }

    return prisma.overtimeRecord.create({
      data: {
        workspaceId: attendance.workspaceId,
        employeeId: attendance.employeeId,
        date: attendance.date,
        hours: Math.round(overtimeHours * 100) / 100,
        type,
        rate,
        status: "pending",
      },
    });
  }

  return prisma.overtimeRecord.create({
    data: {
      workspaceId: attendance.workspaceId,
      employeeId: attendance.employeeId,
      date: attendance.date,
      hours: Math.round(overtimeHours * 100) / 100,
      type,
      rate,
      status: "approved",
    },
  });
}

export async function getOvertimeRecords(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  employeeId?: string
): Promise<OvertimeRecord[]> {
  return prisma.overtimeRecord.findMany({
    where: {
      workspaceId,
      date: { gte: startDate, lte: endDate },
      ...(employeeId ? { employeeId } : {}),
    },
    include: { employee: { select: { id: true, name: true, employeeId: true } } },
    orderBy: { date: "desc" },
  });
}

export async function approveOvertime(overtimeId: string, approverId: string): Promise<OvertimeRecord> {
  const record = await prisma.overtimeRecord.findUnique({
    where: { id: overtimeId },
  });

  if (!record) {
    throw new Error("Overtime record not found");
  }

  if (record.status !== "pending") {
    throw new Error("Overtime record is not pending");
  }

  return prisma.overtimeRecord.update({
    where: { id: overtimeId },
    data: {
      status: "approved",
      approvedBy: approverId,
      approvedAt: new Date(),
    },
  });
}

export async function rejectOvertime(overtimeId: string, approverId: string): Promise<OvertimeRecord> {
  const record = await prisma.overtimeRecord.findUnique({
    where: { id: overtimeId },
  });

  if (!record) {
    throw new Error("Overtime record not found");
  }

  if (record.status !== "pending") {
    throw new Error("Overtime record is not pending");
  }

  return prisma.overtimeRecord.update({
    where: { id: overtimeId },
    data: {
      status: "rejected",
      approvedBy: approverId,
      approvedAt: new Date(),
    },
  });
}

export async function getOvertimeSummary(
  workspaceId: string,
  employeeId: string,
  month: string
): Promise<OvertimeSummary> {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59);

  const records = await prisma.overtimeRecord.findMany({
    where: {
      workspaceId,
      employeeId,
      date: { gte: start, lte: end },
    },
  });

  const summary: OvertimeSummary = {
    totalHours: 0,
    regularHours: 0,
    weekendHours: 0,
    holidayHours: 0,
    approvedHours: 0,
    pendingHours: 0,
    totalPay: 0,
  };

  for (const record of records) {
    summary.totalHours += record.hours;

    if (record.type === "regular") summary.regularHours += record.hours;
    else if (record.type === "weekend") summary.weekendHours += record.hours;
    else if (record.type === "holiday") summary.holidayHours += record.hours;

    if (record.status === "approved") {
      summary.approvedHours += record.hours;
      summary.totalPay += record.hours * record.rate;
    } else if (record.status === "pending") {
      summary.pendingHours += record.hours;
    }
  }

  summary.totalHours = Math.round(summary.totalHours * 100) / 100;
  summary.regularHours = Math.round(summary.regularHours * 100) / 100;
  summary.weekendHours = Math.round(summary.weekendHours * 100) / 100;
  summary.holidayHours = Math.round(summary.holidayHours * 100) / 100;
  summary.approvedHours = Math.round(summary.approvedHours * 100) / 100;
  summary.pendingHours = Math.round(summary.pendingHours * 100) / 100;
  summary.totalPay = Math.round(summary.totalPay * 100) / 100;

  return summary;
}

function parseOfficeMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}
