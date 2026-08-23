import { prisma } from "@/lib/prisma";
import type { AttendanceSettings, AttendanceReminder, Employee } from "@prisma/client";
import { notify } from "@/lib/actions";

export type MissingAttendanceEmployee = {
  id: string;
  name: string;
  employeeId: string;
  email: string;
};

export type ReminderLog = AttendanceReminder & {
  employee: { name: string; employeeId: string };
};

export async function checkMissingAttendance(
  workspaceId: string
): Promise<MissingAttendanceEmployee[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const settings = await prisma.attendanceSettings.findUnique({
    where: { workspaceId },
  });

  const employees = await prisma.employee.findMany({
    where: {
      workspaceId,
      status: { in: ["active", "on_leave"] },
    },
    select: {
      id: true,
      name: true,
      employeeId: true,
      email: true,
    },
  });

  const attendanceToday = await prisma.attendance.findMany({
    where: {
      workspaceId,
      date: { gte: today, lt: tomorrow },
    },
    select: { employeeId: true },
  });

  const clockedInIds = new Set(attendanceToday.map((a) => a.employeeId));

  const workingDaysStr = settings?.workingDays || '["mon","tue","wed","thu","fri"]';
  const workingDays: string[] = JSON.parse(workingDaysStr);
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const workingDayNums = workingDays.map((d) => dayMap[d]).filter((d) => d !== undefined);

  if (!workingDayNums.includes(today.getDay())) {
    return [];
  }

  return employees.filter((emp) => !clockedInIds.has(emp.id));
}

export async function sendReminders(workspaceId: string): Promise<number> {
  const settings = await prisma.attendanceSettings.findUnique({
    where: { workspaceId },
  });

  if (!settings || !settings.remindersEnabled) {
    return 0;
  }

  const missingEmployees = await checkMissingAttendance(workspaceId);

  let sentCount = 0;

  for (const emp of missingEmployees) {
    const shouldSend = await shouldSendReminder(emp.id, settings);
    if (!shouldSend) continue;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await prisma.attendanceReminder.create({
        data: {
          workspaceId,
          employeeId: emp.id,
          date: today,
          type: "missing_clockin",
          channel: settings.reminderEmailEnabled ? "email" : "notification",
        },
      });

      if (settings.reminderEmailEnabled) {
        const users = await prisma.user.findMany({
          where: { employeeId: emp.id },
          select: { id: true },
        });

        for (const user of users) {
          await notify(
            workspaceId,
            user.id,
            "Attendance Reminder",
            "You haven't clocked in today. Please mark your attendance.",
            "/attendance"
          );
        }
      }

      sentCount++;
    } catch {
      // continue with other employees
    }
  }

  return sentCount;
}

export async function getReminderLogs(
  workspaceId: string,
  date: Date
): Promise<ReminderLog[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return prisma.attendanceReminder.findMany({
    where: {
      workspaceId,
      date: { gte: start, lt: end },
    },
    include: {
      employee: { select: { name: true, employeeId: true } },
    },
    orderBy: { sentAt: "desc" },
  });
}

export async function shouldSendReminder(
  employeeId: string,
  settings: AttendanceSettings
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startHour = parseHour(settings.reminderStartHour || "10:00");
  const endHour = parseHour(settings.reminderEndHour || "17:00");
  const currentHour = new Date().getHours();

  if (currentHour < startHour || currentHour >= endHour) {
    return false;
  }

  const todayStart = new Date(today);
  const todayEnd = new Date(today);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const reminderCount = await prisma.attendanceReminder.count({
    where: {
      employeeId,
      date: { gte: todayStart, lt: todayEnd },
    },
  });

  return reminderCount < settings.maxRemindersPerDay;
}

function parseHour(timeStr: string): number {
  const [h] = timeStr.split(":").map(Number);
  return h;
}
