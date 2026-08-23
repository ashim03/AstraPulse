import { prisma } from "@/lib/prisma";
import type { Break, Attendance, AttendanceSettings } from "@prisma/client";

export type BreakWithAttendance = Break & {
  attendance: Attendance;
};

export async function startBreak(attendanceId: string, employeeId: string, workspaceId: string): Promise<Break> {
  const activeBreak = await prisma.break.findFirst({
    where: {
      employeeId,
      status: "active",
    },
  });

  if (activeBreak) {
    throw new Error("You already have an active break");
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance || attendance.workspaceId !== workspaceId) {
    throw new Error("Attendance record not found");
  }

  const breakRecord = await prisma.break.create({
    data: {
      workspaceId,
      attendanceId,
      employeeId,
      breakOut: new Date(),
      status: "active",
    },
  });

  return breakRecord;
}

export async function endBreak(breakId: string, workspaceId: string): Promise<Break> {
  const breakRecord = await prisma.break.findUnique({
    where: { id: breakId },
  });

  if (!breakRecord || breakRecord.workspaceId !== workspaceId) {
    throw new Error("Break record not found");
  }

  if (breakRecord.status !== "active") {
    throw new Error("Break is not active");
  }

  const breakIn = new Date();
  const durationMs = breakIn.getTime() - breakRecord.breakOut.getTime();
  const duration = Math.round(durationMs / (1000 * 60));

  const settings = await prisma.attendanceSettings.findUnique({
    where: { workspaceId },
  });

  let status = "completed";
  if (settings && settings.breakDurationMinutes > 0 && duration > settings.breakDurationMinutes) {
    status = "late_return";
  }

  const updated = await prisma.break.update({
    where: { id: breakId },
    data: {
      breakIn,
      duration,
      status,
    },
  });

  const totalBreakTime = await calculateTotalBreakTime(breakRecord.attendanceId);
  await prisma.attendance.update({
    where: { id: breakRecord.attendanceId },
    data: { breakMinutes: totalBreakTime },
  });

  return updated;
}

export async function getActiveBreak(employeeId: string): Promise<Break | null> {
  return prisma.break.findFirst({
    where: {
      employeeId,
      status: "active",
    },
    orderBy: { breakOut: "desc" },
  });
}

export async function getBreaksForAttendance(attendanceId: string): Promise<Break[]> {
  return prisma.break.findMany({
    where: { attendanceId },
    orderBy: { breakOut: "asc" },
  });
}

export async function calculateTotalBreakTime(attendanceId: string): Promise<number> {
  const breaks = await prisma.break.findMany({
    where: {
      attendanceId,
      status: { in: ["completed", "late_return"] },
    },
  });

  return breaks.reduce((total, b) => total + b.duration, 0);
}

export async function applyBreakDeductions(
  attendance: Attendance,
  breaks: Break[],
  settings: AttendanceSettings | null
): Promise<number> {
  if (!settings || !settings.breakEnabled) {
    return attendance.hours;
  }

  if (settings.breakIsPaid) {
    return attendance.hours;
  }

  const totalBreakMinutes = breaks
    .filter((b) => b.status === "completed" || b.status === "late_return")
    .reduce((sum, b) => sum + b.duration, 0);

  const breakHours = totalBreakMinutes / 60;
  return Math.max(0, attendance.hours - breakHours);
}
