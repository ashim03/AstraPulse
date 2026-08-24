import { prisma } from "@/lib/prisma";

// ─── Nepal Time (UTC+5:45) ───────────────────────────────────────────────────
const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;

function toNepalTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + NPL_OFFSET_MS);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const OFFICE_START_HOUR = 9;
const OFFICE_START_MIN = 30;
const OFFICE_END_HOUR = 17;
const OFFICE_END_MIN = 30;
const GRACE_MINUTES = 10;
const POST_WORK_GRACE_MINUTES = 5;
const ABSENT_AFTER_MINUTES = 10; // after grace = absent
const MAX_BREAK_MINUTES = 35;
const STANDARD_WORK_HOURS = 8;

// ─── Default Settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  officeStartTime: "09:30",
  officeEndTime: "17:30",
  officeTimezone: "Asia/Kathmandu",
  graceMinutes: GRACE_MINUTES,
  absentIfLateByMinutes: ABSENT_AFTER_MINUTES,
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
  breakStartTime: "09:30",
  breakEndTime: "17:30",
  breakDurationMinutes: MAX_BREAK_MINUTES,
  maxBreaksPerDay: 1,
  breakIsPaid: false,
  remindersEnabled: false,
  reminderStartHour: "09:30",
  reminderEndHour: "17:30",
  maxRemindersPerDay: 8,
  reminderEmailEnabled: true,
  lateDeductionEnabled: true,
  lateDeductionPerMinute: 0,
  absentDeductionEnabled: true,
  halfDayDeductionPercent: 50,
};

export type AttendanceSettingsData = typeof DEFAULT_SETTINGS;

// ─── Settings CRUD ────────────────────────────────────────────────────────────

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

// ─── Day Helpers ──────────────────────────────────────────────────────────────

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

// ─── Nepal Time Calculations ──────────────────────────────────────────────────

function getNepalMinutes(utcDate: Date): number {
  const npl = toNepalTime(utcDate);
  return npl.getUTCHours() * 60 + npl.getUTCMinutes();
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ─── Status Determination (Nepal Time Based) ──────────────────────────────────

export type AttendanceStatusResult = {
  status: string;
  isLate: boolean;
  lateMinutes: number;
  isAbsent: boolean;
  isHalfDay: boolean;
};

/**
 * Determine attendance status based on check-in time.
 *
 * Rules:
 * - Check-in ≤ 9:40 AM (9:30 + 10min grace) → Present
 * - Check-in > 9:40 AM without approved exception → Absent
 */
export function determineCheckInStatus(
  settings: { officeStartTime: string; graceMinutes: number; absentIfLateByMinutes: number },
  clockInTime: Date
): AttendanceStatusResult {
  const clockInMinutes = getNepalMinutes(clockInTime);
  const officeStartMinutes = parseTimeToMinutes(settings.officeStartTime);
  const graceDeadline = officeStartMinutes + settings.graceMinutes; // 9:40 = 580

  const lateMinutes = Math.max(0, clockInMinutes - officeStartMinutes);

  if (clockInMinutes <= graceDeadline) {
    return { status: "present", isLate: false, lateMinutes: 0, isAbsent: false, isHalfDay: false };
  }

  // After grace period = absent (unless approved leave)
  return { status: "absent", isLate: true, lateMinutes, isAbsent: true, isHalfDay: false };
}

/**
 * Determine check-out status.
 *
 * Rules:
 * - Check-out ≤ 5:35 PM → Normal checkout
 * - Check-out > 5:35 PM → Overtime
 */
export function determineCheckOutStatus(
  settings: { officeEndTime: string },
  clockOutTime: Date
): { isOvertime: boolean; overtimeMinutes: number; isEarlyDeparture: boolean; earlyMinutes: number } {
  const clockOutMinutes = getNepalMinutes(clockOutTime);
  const officeEndMinutes = parseTimeToMinutes(settings.officeEndTime);
  const overtimeThreshold = officeEndMinutes + POST_WORK_GRACE_MINUTES; // 5:35 PM = 1055

  const isOvertime = clockOutMinutes > overtimeThreshold;
  const overtimeMinutes = isOvertime ? clockOutMinutes - overtimeThreshold : 0;

  const isEarlyDeparture = clockOutMinutes < officeEndMinutes;
  const earlyMinutes = isEarlyDeparture ? officeEndMinutes - clockOutMinutes : 0;

  return { isOvertime, overtimeMinutes, isEarlyDeparture, earlyMinutes };
}

/**
 * Calculate working hours, excluding break time.
 */
export function calculateWorkingHours(
  clockIn: Date,
  clockOut: Date,
  breakMinutes: number
): number {
  const totalMs = clockOut.getTime() - clockIn.getTime();
  const totalMinutes = totalMs / 60000;
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
  return Math.round((workedMinutes / 60) * 100) / 100;
}

// ─── Break Validation ─────────────────────────────────────────────────────────

export type BreakValidation = {
  allowed: boolean;
  reason?: string;
};

/**
 * Validate if a break can be started.
 *
 * Rules:
 * - Only once per day
 * - Max 35 minutes
 * - Must be during working hours
 */
export function canStartBreak(
  existingBreaksToday: number,
  breakStartTime: Date,
  settings: { breakEnabled: boolean; maxBreaksPerDay: number }
): BreakValidation {
  if (!settings.breakEnabled) {
    return { allowed: false, reason: "Breaks are not enabled" };
  }

  if (existingBreaksToday >= settings.maxBreaksPerDay) {
    return { allowed: false, reason: "You have already used your break for today" };
  }

  const breakMinutes = getNepalMinutes(breakStartTime);
  const workStart = parseTimeToMinutes(DEFAULT_SETTINGS.officeStartTime);
  const workEnd = parseTimeToMinutes(DEFAULT_SETTINGS.officeEndTime);

  if (breakMinutes < workStart || breakMinutes > workEnd) {
    return { allowed: false, reason: "Break can only be started during working hours" };
  }

  return { allowed: true };
}

/**
 * Validate break duration.
 */
export function validateBreakDuration(breakIn: Date, breakOut: Date): BreakValidation {
  const durationMs = breakIn.getTime() - breakOut.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  if (durationMinutes > MAX_BREAK_MINUTES) {
    return {
      allowed: false,
      reason: `Break exceeds maximum allowed duration of ${MAX_BREAK_MINUTES} minutes`,
    };
  }

  return { allowed: true };
}

// ─── Overtime Calculation ─────────────────────────────────────────────────────

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

// ─── Constants Export ─────────────────────────────────────────────────────────

export const ATTENDANCE_CONSTANTS = {
  OFFICE_START: `${OFFICE_START_HOUR}:${String(OFFICE_START_MIN).padStart(2, "0")}`,
  OFFICE_END: `${OFFICE_END_HOUR}:${String(OFFICE_END_MIN).padStart(2, "0")}`,
  GRACE_PERIOD_END: `${OFFICE_START_HOUR}:${String(OFFICE_START_MIN + GRACE_MINUTES).padStart(2, "0")}`,
  OVERTIME_THRESHOLD: `${OFFICE_END_HOUR}:${String(OFFICE_END_MIN + POST_WORK_GRACE_MINUTES).padStart(2, "0")}`,
  MAX_BREAK_MINUTES,
  STANDARD_WORK_HOURS,
  POST_WORK_GRACE_MINUTES,
  GRACE_MINUTES,
} as const;
