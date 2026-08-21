import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

export type AttendanceStats = {
  present: number;
  absent: number;
  late: number;
  early: number;
  overtime: number;
  remote: number;
  totalHours: number;
};

export async function attendanceStatsForDay(workspaceId: string, date: Date): Promise<AttendanceStats> {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const records = await prisma.attendance.findMany({
    where: { workspaceId, date: { gte: start, lte: end } },
  });
  const activeEmployees = await prisma.employee.count({
    where: { workspaceId, status: { in: ["active", "on_leave"] } },
  });
  const stats: AttendanceStats = {
    present: 0,
    absent: 0,
    late: 0,
    early: 0,
    overtime: 0,
    remote: 0,
    totalHours: 0,
  };
  for (const r of records) {
    if (r.status === "present") stats.present++;
    else if (r.status === "late") {
      stats.late++;
      stats.present++;
    } else if (r.status === "early") {
      stats.early++;
      stats.present++;
    } else if (r.status === "remote") {
      stats.remote++;
      stats.present++;
    }
    stats.totalHours += r.hours;
    if (r.overtime > 0) stats.overtime++;
  }
  stats.absent = Math.max(0, activeEmployees - stats.present);
  return stats;
}

export async function attendanceTrend(workspaceId: string, days = 30) {
  const from = startOfDay(subDays(new Date(), days - 1));
  const records = await prisma.attendance.findMany({
    where: { workspaceId, date: { gte: from } },
  });
  const byDay = new Map<string, AttendanceStats>();
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    if (!byDay.has(key)) {
      byDay.set(key, { present: 0, absent: 0, late: 0, early: 0, overtime: 0, remote: 0, totalHours: 0 });
    }
    const s = byDay.get(key)!;
    s.totalHours += r.hours;
    if (r.status === "present" || r.status === "late" || r.status === "early" || r.status === "remote") s.present++;
    if (r.status === "late") s.late++;
    if (r.status === "remote") s.remote++;
  }
  return Array.from(byDay.entries()).map(([date, stats]) => ({ date, ...stats }));
}