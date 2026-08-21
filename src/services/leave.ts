import { prisma } from "@/lib/prisma";
import { eachDayOfInterval, startOfDay, format } from "date-fns";

export type LeaveBalance = {
  typeId: string;
  name: string;
  color: string;
  entitlement: number;
  used: number;
  pending: number;
  remaining: number;
};

export async function computeLeaveBalance(workspaceId: string, employeeId: string, year = new Date().getFullYear()): Promise<LeaveBalance[]> {
  const types = await prisma.leaveType.findMany({ where: { workspaceId } });
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      startDate: { gte: start, lte: end },
      status: { in: ["approved", "pending", "approved"] },
    },
  });

  return types.map((type) => {
    const used = requests
      .filter((r) => r.typeId === type.id && r.status === "approved")
      .reduce((acc, r) => acc + r.days, 0);
    const pending = requests
      .filter((r) => r.typeId === type.id && r.status === "pending")
      .reduce((acc, r) => acc + r.days, 0);
    const entitlement = type.daysPerYear;
    return {
      typeId: type.id,
      name: type.name,
      color: type.color,
      entitlement,
      used,
      pending,
      remaining: Math.max(0, entitlement - used - pending),
    };
  });
}

export function countLeaveDays(start: Date, end: Date, holidays: Date[] = []): number {
  const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
  let count = 0;
  for (const day of days) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidays.some((h) => format(h, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))) continue;
    count += 1;
  }
  return count;
}

export async function workspaceHolidays(workspaceId: string): Promise<Date[]> {
  const holidays = await prisma.holiday.findMany({
    where: {
      workspaceId,
      OR: [{ recurring: true }, { date: { gte: new Date(new Date().getFullYear(), 0, 1) } }],
    },
  });
  return holidays.map((h) => h.date);
}