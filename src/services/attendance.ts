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

  const [grouped, aggResult, activeEmployees] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { workspaceId, date: { gte: start, lte: end } },
      _count: { _all: true },
    }),
    prisma.attendance.aggregate({
      where: { workspaceId, date: { gte: start, lte: end } },
      _sum: { hours: true },
      _count: { id: true },
    }),
    prisma.employee.count({
      where: { workspaceId, status: { in: ["active", "on_leave"] } },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of grouped) {
    statusCounts[g.status] = g._count._all;
  }

  const present = (statusCounts["present"] ?? 0)
    + (statusCounts["late"] ?? 0)
    + (statusCounts["early"] ?? 0)
    + (statusCounts["remote"] ?? 0);

  const overtimeCount = await prisma.attendance.count({
    where: { workspaceId, date: { gte: start, lte: end }, overtime: { gt: 0 } },
  });

  return {
    present,
    absent: Math.max(0, activeEmployees - present),
    late: statusCounts["late"] ?? 0,
    early: statusCounts["early"] ?? 0,
    overtime: overtimeCount,
    remote: statusCounts["remote"] ?? 0,
    totalHours: aggResult._sum.hours ?? 0,
  };
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