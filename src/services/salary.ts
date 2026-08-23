import { prisma } from "@/lib/prisma";
import type { Employee, SalaryComponent, Attendance, EmployeeAdvance, AttendanceSettings, SalaryConfig, PayrollPeriod } from "@prisma/client";

export type EmployeeWithSalaryData = Employee & {
  salaryComponents: SalaryComponent[];
  department: { id: string; name: string } | null;
  salaryConfigs: SalaryConfig[];
};

export type SalaryBreakdown = {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  baseSalary: number;
  salaryType: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalHours: number;
  overtimeHours: number;
  lateMinutes: number;
  allowances: number;
  bonuses: number;
  overtimePay: number;
  weekendPay: number;
  holidayPay: number;
  gross: number;
  lateDeduction: number;
  absentDeduction: number;
  leaveDeduction: number;
  halfDayDeduction: number;
  totalDeductions: number;
  tax: number;
  advanceDeduction: number;
  net: number;
  status: "ready" | "needs_review";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function countWorkingDaysInPeriod(start: Date, end: Date, workingDaysStr: string): number {
  const workingDays: string[] = JSON.parse(workingDaysStr || '["mon","tue","wed","thu","fri"]');
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const workingDayNums = workingDays.map((d) => dayMap[d]).filter((d) => d !== undefined);

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (workingDayNums.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function parseOfficeMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function calculateEmployeeSalary(
  employee: EmployeeWithSalaryData,
  attendanceRecords: Attendance[],
  advances: EmployeeAdvance[],
  salaryConfig: SalaryConfig | null,
  attendanceSettings: AttendanceSettings | null,
  period: { start: Date; end: Date }
): SalaryBreakdown {
  const settings = attendanceSettings ?? {
    officeStartTime: "10:00",
    officeEndTime: "18:00",
    graceMinutes: 15,
    lateDeductionEnabled: true,
    lateDeductionPerMinute: 0,
    absentDeductionEnabled: true,
    halfDayDeductionPercent: 50,
    overtimeEnabled: true,
    overtimeRateMultiplier: 1.5,
    weekendOvertimeRate: 2.0,
    holidayOvertimeRate: 2.5,
    workingDays: '["mon","tue","wed","thu","fri"]',
    weekendDays: '["sat","sun"]',
    breakIsPaid: false,
  } as AttendanceSettings;

  const workingDaysStr = settings.workingDays || '["mon","tue","wed","thu","fri"]';
  const totalWorkingDays = countWorkingDaysInPeriod(period.start, period.end, workingDaysStr);

  const baseSalary = employee.baseSalary || salaryConfig?.baseSalary || 0;
  const salaryType = employee.salaryType || salaryConfig?.salaryType || "monthly";

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let totalHours = 0;
  let overtimeHours = 0;
  let lateMinutes = 0;

  for (const record of attendanceRecords) {
    if (record.status === "present" || record.status === "late" || record.status === "early" || record.status === "remote") {
      presentDays++;
      if (record.isHalfDay) {
        halfDays++;
      }
      totalHours += record.hours;
      overtimeHours += record.overtime;
      lateMinutes += record.lateMinutes;
    } else if (record.status === "absent") {
      absentDays++;
    } else if (record.status === "on_leave") {
      presentDays++;
    }
  }

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  if (attendanceRecords.length > 0) {
    for (const r of attendanceRecords) {
      if (r.status === "on_leave") {
        paidLeaveDays++;
      }
    }
  }

  const calculatedAbsentDays = Math.max(0, totalWorkingDays - presentDays - absentDays - paidLeaveDays);
  absentDays = calculatedAbsentDays;

  const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
  const hourlyRate = 8 > 0 ? dailyRate / 8 : 0;
  const perMinuteRate = settings.lateDeductionPerMinute > 0
    ? settings.lateDeductionPerMinute
    : dailyRate / (8 * 60);

  let allowances = 0;
  let bonuses = 0;
  for (const c of employee.salaryComponents) {
    if (c.type === "allowance") allowances += c.amount;
    else if (c.type === "bonus") bonuses += c.amount;
  }

  let overtimePay = 0;
  if (settings.overtimeEnabled) {
    overtimePay = overtimeHours * hourlyRate * settings.overtimeRateMultiplier;
  }

  let weekendPay = 0;
  for (const record of attendanceRecords) {
    if (record.isWeekend && record.hours > 0) {
      weekendPay += record.hours * hourlyRate * (settings.weekendOvertimeRate - 1);
    }
  }

  let holidayPay = 0;
  for (const record of attendanceRecords) {
    if (record.isHoliday && record.hours > 0) {
      holidayPay += record.hours * hourlyRate * (settings.holidayOvertimeRate - 1);
    }
  }

  const gross = baseSalary + allowances + bonuses + overtimePay + weekendPay + holidayPay;

  let lateDeduction = 0;
  if (settings.lateDeductionEnabled && lateMinutes > 0) {
    lateDeduction = lateMinutes * perMinuteRate;
  }

  let absentDeduction = 0;
  if (settings.absentDeductionEnabled && absentDays > 0) {
    absentDeduction = dailyRate * absentDays;
  }

  let leaveDeduction = 0;
  leaveDeduction = dailyRate * unpaidLeaveDays;

  let halfDayDeduction = 0;
  if (halfDays > 0) {
    halfDayDeduction = (baseSalary * settings.halfDayDeductionPercent / 100 / totalWorkingDays) * halfDays;
  }

  const totalDeductions = lateDeduction + absentDeduction + leaveDeduction + halfDayDeduction;

  let tax = 0;
  if (salaryConfig?.taxEnabled && salaryConfig.taxRate > 0) {
    tax = gross * salaryConfig.taxRate / 100;
  }

  let advanceDeduction = 0;
  for (const adv of advances) {
    if (adv.status === "approved" || adv.status === "paid") {
      if (adv.outstanding > 0) {
        const deduction = Math.min(adv.installment, adv.outstanding);
        advanceDeduction += deduction;
      }
    }
  }
  advanceDeduction = Math.min(advanceDeduction, Math.max(gross * 0.5, 0));

  const net = Math.max(0, gross - totalDeductions - tax - advanceDeduction);

  const status: "ready" | "needs_review" =
    absentDays > 0 || halfDays > 0 || lateMinutes > 0 ? "needs_review" : "ready";

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    departmentName: employee.department?.name ?? "—",
    baseSalary,
    salaryType,
    workingDays: totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    totalHours,
    overtimeHours,
    lateMinutes,
    allowances,
    bonuses,
    overtimePay,
    weekendPay,
    holidayPay,
    gross: Math.round(gross * 100) / 100,
    lateDeduction: Math.round(lateDeduction * 100) / 100,
    absentDeduction: Math.round(absentDeduction * 100) / 100,
    leaveDeduction: Math.round(leaveDeduction * 100) / 100,
    halfDayDeduction: Math.round(halfDayDeduction * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    advanceDeduction: Math.round(advanceDeduction * 100) / 100,
    net: Math.round(net * 100) / 100,
    status,
  };
}

export async function calculatePayrollPreview(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<SalaryBreakdown[]> {
  const employees = await prisma.employee.findMany({
    where: { workspaceId, status: { in: ["active", "on_leave"] } },
    include: {
      salaryComponents: true,
      department: { select: { id: true, name: true } },
      salaryConfigs: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      workspaceId,
      date: { gte: startDate, lte: endDate },
    },
  });

  const advances = await prisma.employeeAdvance.findMany({
    where: {
      workspaceId,
      status: { in: ["approved", "paid"] },
      outstanding: { gt: 0 },
    },
  });

  const attendanceSettings = await prisma.attendanceSettings.findUnique({
    where: { workspaceId },
  });

  const salaryConfigs = await prisma.salaryConfig.findMany({
    where: { workspaceId },
  });

  const breakdowns: SalaryBreakdown[] = [];

  for (const employee of employees) {
    const empAttendances = attendanceRecords.filter((a) => a.employeeId === employee.id);
    const empAdvances = advances.filter((a) => a.employeeId === employee.id);
    const empSalaryConfig = employee.salaryConfigs[0] ?? salaryConfigs.find((sc) => sc.employeeId === employee.id) ?? null;

    const breakdown = calculateEmployeeSalary(
      employee as EmployeeWithSalaryData,
      empAttendances,
      empAdvances,
      empSalaryConfig,
      attendanceSettings,
      { start: startDate, end: endDate }
    );

    breakdowns.push(breakdown);
  }

  return breakdowns;
}

export async function generatePayrollFromPreview(
  workspaceId: string,
  preview: SalaryBreakdown[],
  period: PayrollPeriod
) {
  if (preview.length === 0) {
    throw new Error("No employees to process");
  }

  const totals = preview.reduce(
    (acc, item) => ({
      gross: acc.gross + item.gross,
      deductions: acc.deductions + item.totalDeductions + item.advanceDeduction,
      tax: acc.tax + item.tax,
      net: acc.net + item.net,
    }),
    { gross: 0, deductions: 0, tax: 0, net: 0 }
  );

  const payroll = await prisma.payroll.create({
    data: {
      workspaceId,
      period: `${period.startDate.toISOString().slice(0, 7)}`,
      name: period.name,
      status: "calculated",
      grossTotal: Math.round(totals.gross * 100) / 100,
      deductionTotal: Math.round(totals.deductions * 100) / 100,
      taxTotal: Math.round(totals.tax * 100) / 100,
      netTotal: Math.round(totals.net * 100) / 100,
      employerCostTotal: Math.round(totals.gross * 100) / 100,
      processedAt: new Date(),
      items: {
        create: preview.map((item) => ({
          employeeId: item.employeeId,
          baseSalary: item.baseSalary,
          allowances: item.allowances,
          bonuses: item.bonuses,
          overtime: item.overtimePay,
          overtimeHours: item.overtimeHours,
          weekendPay: item.weekendPay,
          holidayPay: item.holidayPay,
          gross: item.gross,
          lateDeduction: item.lateDeduction,
          absentDeduction: item.absentDeduction,
          leaveDeduction: item.leaveDeduction,
          halfDayDeduction: item.halfDayDeduction,
          deductions: item.totalDeductions,
          tax: item.tax,
          advanceDeduction: item.advanceDeduction,
          benefits: 0,
          net: item.net,
          employerCost: item.gross,
          workingDays: item.workingDays,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          halfDays: item.halfDays,
          paidLeaveDays: item.paidLeaveDays,
          unpaidLeaveDays: item.unpaidLeaveDays,
          totalHours: item.totalHours,
          paymentStatus: "pending",
        })),
      },
    },
    include: { items: true },
  });

  return payroll;
}
