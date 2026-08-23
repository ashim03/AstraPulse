import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  officeTimezone: "Asia/Kathmandu",
  graceMinutes: 15,
  absentIfLateByMinutes: 0,
  halfDayAfterMinutes: 240,
  minimumWorkMinutes: 180,
  workingDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri"]),
  weekendDays: JSON.stringify(["sat", "sun"]),
  overtimeEnabled: true,
  overtimeRequiresApproval: true,
  overtimeRateMultiplier: 1.5,
  weekendOvertimeRate: 2.0,
  holidayOvertimeRate: 2.5,
  breakEnabled: true,
  breakStartTime: "12:00",
  breakEndTime: "13:00",
  breakDurationMinutes: 60,
  maxBreaksPerDay: 1,
  breakIsPaid: false,
  remindersEnabled: false,
  reminderStartHour: "10:00",
  reminderEndHour: "17:00",
  maxRemindersPerDay: 8,
  reminderEmailEnabled: true,
  lateDeductionEnabled: true,
  lateDeductionPerMinute: 0,
  absentDeductionEnabled: true,
  halfDayDeductionPercent: 50,
};

export type AttendanceSettingsData = typeof DEFAULT_SETTINGS;

export async function getAttendanceSettings(workspaceId: string) {
  const existing = await prisma.attendanceSettings.findFirst({
    where: { workspaceId },
  });
  if (existing) return existing;
  return prisma.attendanceSettings.create({
    data: { workspaceId, ...DEFAULT_SETTINGS },
  });
}

export async function updateAttendanceSettings(
  workspaceId: string,
  data: Partial<AttendanceSettingsData>
) {
  const existing = await prisma.attendanceSettings.findFirst({
    where: { workspaceId },
  });
  if (!existing) {
    return prisma.attendanceSettings.create({
      data: { workspaceId, ...DEFAULT_SETTINGS, ...data },
    });
  }
  return prisma.attendanceSettings.update({
    where: { id: existing.id },
    data,
  });
}

const DAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function isWorkingDay(settings: { workingDays: string }, date: Date): boolean {
  const days: string[] = JSON.parse(settings.workingDays);
  const dayOfWeek = date.getDay();
  const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0];
  return dayName ? days.includes(dayName) : false;
}

export function getOfficeHours(settings: { officeStartTime: string; officeEndTime: string }) {
  return {
    start: settings.officeStartTime,
    end: settings.officeEndTime,
  };
}

export function calculateGraceTime(settings: { officeStartTime: string; graceMinutes: number }) {
  const [h, m] = settings.officeStartTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + settings.graceMinutes;
  const graceH = Math.floor(totalMinutes / 60) % 24;
  const graceM = totalMinutes % 60;
  return `${String(graceH).padStart(2, "0")}:${String(graceM).padStart(2, "0")}`;
}

export function isLateArrival(
  settings: { officeStartTime: string; graceMinutes: number },
  clockInTime: Date,
  _date?: Date
): { isLate: boolean; lateMinutes: number } {
  const [oh, om] = settings.officeStartTime.split(":").map(Number);
  const graceMinutes = settings.graceMinutes;

  const clockInMinutes = clockInTime.getHours() * 60 + clockInTime.getMinutes();
  const officeStartMinutes = oh * 60 + om;
  const graceDeadline = officeStartMinutes + graceMinutes;

  if (clockInMinutes <= graceDeadline) {
    return { isLate: false, lateMinutes: 0 };
  }
  return {
    isLate: true,
    lateMinutes: clockInMinutes - officeStartMinutes,
  };
}

export function shouldMarkAbsent(settings: { absentIfLateByMinutes: number }, lateMinutes: number): boolean {
  if (!settings.absentIfLateByMinutes || settings.absentIfLateByMinutes <= 0) return false;
  return lateMinutes >= settings.absentIfLateByMinutes;
}

export function shouldMarkHalfDay(settings: { halfDayAfterMinutes: number }, lateMinutes: number): boolean {
  if (!settings.halfDayAfterMinutes || settings.halfDayAfterMinutes <= 0) return false;
  return lateMinutes >= settings.halfDayAfterMinutes;
}

export function calculateOvertime(
  workedMinutes: number,
  officeMinutes: number,
  settings: {
    overtimeEnabled: boolean;
    overtimeRateMultiplier: number;
    weekendOvertimeRate: number;
    holidayOvertimeRate: number;
  },
  isWeekend = false,
  isHoliday = false
): { overtimeMinutes: number; rate: number } {
  if (!settings.overtimeEnabled) return { overtimeMinutes: 0, rate: 0 };
  const overtimeMinutes = Math.max(0, workedMinutes - officeMinutes);
  if (overtimeMinutes <= 0) return { overtimeMinutes: 0, rate: 0 };
  let rate = settings.overtimeRateMultiplier;
  if (isHoliday) rate = settings.holidayOvertimeRate;
  else if (isWeekend) rate = settings.weekendOvertimeRate;
  return { overtimeMinutes, rate };
}
