import { prisma } from "@/lib/prisma";
import type { Employee, SalaryComponent } from "@prisma/client";

export type EmployeeWithComponents = Employee & { salaryComponents: SalaryComponent[] };

export type PayrollCalculation = {
  baseSalary: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  gross: number;
  deductions: number;
  tax: number;
  advanceDeduction: number;
  benefits: number;
  net: number;
  employerCost: number;
};

export type PayrollData = {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  month: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  overtimeHours: number;
  breakViolations: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalHours: number;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  overtimePay: number;
  weekendPay: number;
  holidayPay: number;
  gross: number;
  lateDeduction: number;
  absentDeduction: number;
  halfDayDeduction: number;
  leaveDeduction: number;
  totalDeductions: number;
  tax: number;
  advanceDeduction: number;
  net: number;
  paymentStatus: string;
};

const SOCIAL_SECURITY_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const TAX_BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 11000, rate: 0.1 },
  { upTo: 44725, rate: 0.12 },
  { upTo: 95375, rate: 0.22 },
  { upTo: 182100, rate: 0.24 },
  { upTo: 231250, rate: 0.32 },
  { upTo: 578125, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

export function estimateIncomeTax(annualGross: number): number {
  let tax = 0;
  let remaining = annualGross;
  let prev = 0;
  for (const bracket of TAX_BRACKETS) {
    if (annualGross <= prev) break;
    const taxableInBracket = Math.min(remaining, bracket.upTo - prev);
    if (taxableInBracket <= 0) break;
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
    prev = bracket.upTo;
    if (annualGross <= bracket.upTo) break;
  }
  return tax;
}

export function calculatePayrollForEmployee(
  employee: EmployeeWithComponents,
  opts?: { overtimeHours?: number; hourlyRate?: number }
): PayrollCalculation {
  const monthlySalary = employee.baseSalary;
  const annualGross = monthlySalary * 12;

  let allowances = 0;
  let bonuses = 0;
  let deductions = 0;
  let benefits = 0;
  for (const c of employee.salaryComponents) {
    if (c.type === "allowance") allowances += c.amount;
    else if (c.type === "bonus") bonuses += c.amount;
    else if (c.type === "deduction") deductions += c.amount;
  }

  const overtimeHours = opts?.overtimeHours ?? 0;
  const hourly = opts?.hourlyRate ?? monthlySalary / 160;
  const overtime = overtimeHours * hourly * 1.5;

  const gross = monthlySalary + allowances + bonuses + overtime;
  const tax = Math.round(estimateIncomeTax(annualGross) / 12 * 100) / 100;
  const socialSecurity = gross * SOCIAL_SECURITY_RATE;
  const medicare = gross * MEDICARE_RATE;
  const totalDeductions = deductions + socialSecurity + medicare;

  const net = gross - totalDeductions - tax;
  const employerCost = gross + gross * SOCIAL_SECURITY_RATE + gross * MEDICARE_RATE + benefits;

  return {
    baseSalary: monthlySalary,
    allowances,
    bonuses,
    overtime,
    gross,
    deductions: Math.round(totalDeductions * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    advanceDeduction: 0,
    benefits,
    net: Math.round(net * 100) / 100,
    employerCost: Math.round(employerCost * 100) / 100,
  };
}

export async function buildPayrollRun(workspaceId: string, period: string) {
  const employees = await prisma.employee.findMany({
    where: { workspaceId, status: { in: ["active", "on_leave"] } },
    include: {
      salaryComponents: true,
      advances: { where: { status: { in: ["approved", "paid"] }, outstanding: { gt: 0 } }, orderBy: { date: "asc" } },
    },
  });

  const items = employees.map((employee) => {
    const calc = calculatePayrollForEmployee(employee);
    const advanceTotal = employee.advances.reduce((acc, a) => acc + (a.outstanding > 0 ? a.installment : 0), 0);
    const advanceDeduction = Math.min(advanceTotal, Math.max(calc.net * 0.5, 0));
    const net = Math.max(0, calc.net - advanceDeduction);
    return {
      employeeId: employee.id,
      baseSalary: calc.baseSalary,
      allowances: calc.allowances,
      bonuses: calc.bonuses,
      overtime: calc.overtime,
      gross: Math.round(calc.gross * 100) / 100,
      deductions: calc.deductions,
      tax: calc.tax,
      advanceDeduction,
      benefits: calc.benefits,
      net: Math.round(net * 100) / 100,
      employerCost: calc.employerCost,
      paymentStatus: "pending",
    };
  });

  const totals = items.reduce(
    (acc, i) => ({
      gross: acc.gross + i.gross,
      deductions: acc.deductions + i.deductions + i.advanceDeduction,
      tax: acc.tax + i.tax,
      net: acc.net + i.net,
      employer: acc.employer + i.employerCost,
    }),
    { gross: 0, deductions: 0, tax: 0, net: 0, employer: 0 }
  );

  return { items, totals };
}

// ─── Employee Payroll Calculation ──────────────────────────────────────────

function countWorkingDays(start: Date, end: Date, workingDaysStr: string): number {
  const workingDays: string[] = JSON.parse(workingDaysStr || '["mon","tue","wed","thu","fri"]');
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const workingDayNums = workingDays.map((d) => dayMap[d]).filter((d) => d !== undefined);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (workingDayNums.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function calculateEmployeePayroll(employeeId: string, month: string): Promise<PayrollData> {
  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0, 23, 59, 59, 999);

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: {
      salaryComponents: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      salaryConfigs: { orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  const attendanceSettings = await prisma.attendanceSettings.findFirst({
    where: { workspaceId: employee.workspaceId },
  });

  const settings = attendanceSettings ?? {
    officeStartTime: "09:30",
    officeEndTime: "17:30",
    graceMinutes: 10,
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
  } as any;

  const workingDaysStr = settings.workingDays || '["mon","tue","wed","thu","fri"]';
  const totalWorkingDays = countWorkingDays(startDate, endDate, workingDaysStr);

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: "approved",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  const advances = await prisma.employeeAdvance.findMany({
    where: {
      employeeId,
      status: { in: ["approved", "paid"] },
      outstanding: { gt: 0 },
    },
  });

  const breaks = await prisma.break.findMany({
    where: {
      employeeId,
      breakOut: { gte: startDate, lte: endDate },
    },
  });

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let totalHours = 0;
  let overtimeHours = 0;
  let lateMinutes = 0;
  let lateDays = 0;
  let breakViolations = 0;

  for (const record of attendanceRecords) {
    if (record.status === "present" || record.status === "late" || record.status === "early" || record.status === "remote") {
      presentDays++;
      if (record.isHalfDay) halfDays++;
      totalHours += record.hours;
      overtimeHours += record.overtime;
      if (record.lateMinutes > 0) {
        lateMinutes += record.lateMinutes;
        lateDays++;
      }
    } else if (record.status === "absent") {
      absentDays++;
    } else if (record.status === "on_leave") {
      presentDays++;
    }
  }

  for (const brk of breaks) {
    if (brk.duration && brk.duration > (settings.breakDurationMinutes ?? 35)) {
      breakViolations++;
    }
  }

  const leaveTypeIds = Array.from(new Set(leaveRequests.map((l) => l.typeId)));
  const leaveTypes = await prisma.leaveType.findMany({
    where: { id: { in: leaveTypeIds } },
  });
  const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  for (const leave of leaveRequests) {
    const leaveStart = leave.startDate > startDate ? leave.startDate : startDate;
    const leaveEnd = leave.endDate < endDate ? leave.endDate : endDate;
    const days = Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const leaveType = leaveTypeMap.get(leave.typeId);
    if (leaveType && leaveType.daysPerYear > 0) {
      paidLeaveDays += days;
    } else {
      unpaidLeaveDays += days;
    }
  }

  const calculatedAbsentDays = Math.max(0, totalWorkingDays - presentDays - absentDays - paidLeaveDays);
  absentDays = calculatedAbsentDays;

  const baseSalary = employee.baseSalary || employee.salaryConfigs[0]?.baseSalary || 0;
  const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
  const hourlyRate = dailyRate / 8;
  const perMinuteRate = settings.lateDeductionPerMinute > 0
    ? settings.lateDeductionPerMinute
    : hourlyRate / 60;

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

  let halfDayDeduction = 0;
  if (halfDays > 0) {
    halfDayDeduction = (baseSalary * settings.halfDayDeductionPercent / 100 / totalWorkingDays) * halfDays;
  }

  const leaveDeduction = dailyRate * unpaidLeaveDays;
  const totalDeductions = lateDeduction + absentDeduction + halfDayDeduction + leaveDeduction;

  const salaryConfig = employee.salaryConfigs[0] ?? null;
  let tax = 0;
  if (salaryConfig?.taxEnabled && salaryConfig.taxRate > 0) {
    tax = gross * salaryConfig.taxRate / 100;
  }

  let advanceDeduction = 0;
  for (const adv of advances) {
    if (adv.outstanding > 0) {
      advanceDeduction += Math.min(adv.installment, adv.outstanding);
    }
  }
  advanceDeduction = Math.min(advanceDeduction, Math.max(gross * 0.5, 0));

  const net = Math.max(0, gross - totalDeductions - tax - advanceDeduction);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department?.name ?? "—",
    position: employee.position?.name ?? "—",
    month,
    workingDays: totalWorkingDays,
    presentDays,
    absentDays,
    lateDays,
    halfDays,
    overtimeHours,
    breakViolations,
    paidLeaveDays,
    unpaidLeaveDays,
    totalHours,
    baseSalary,
    allowances,
    bonuses,
    overtimePay,
    weekendPay,
    holidayPay,
    gross: Math.round(gross * 100) / 100,
    lateDeduction: Math.round(lateDeduction * 100) / 100,
    absentDeduction: Math.round(absentDeduction * 100) / 100,
    halfDayDeduction: Math.round(halfDayDeduction * 100) / 100,
    leaveDeduction: Math.round(leaveDeduction * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    advanceDeduction: Math.round(advanceDeduction * 100) / 100,
    net: Math.round(net * 100) / 100,
    paymentStatus: "pending",
  };
}

// ─── Payslip Generation ────────────────────────────────────────────────────

export async function generatePayslip(
  employeeId: string,
  month: string,
  payrollData: PayrollData
) {
  const existingPayroll = await prisma.payroll.findFirst({
    where: { period: month },
  });

  if (existingPayroll) {
    const existingItem = await prisma.payrollItem.findFirst({
      where: { payrollId: existingPayroll.id, employeeId },
    });
    if (existingItem) return existingItem;

    return prisma.payrollItem.create({
      data: {
        payrollId: existingPayroll.id,
        employeeId,
        baseSalary: payrollData.baseSalary,
        allowances: payrollData.allowances,
        bonuses: payrollData.bonuses,
        overtime: payrollData.overtimePay,
        overtimeHours: payrollData.overtimeHours,
        weekendPay: payrollData.weekendPay,
        holidayPay: payrollData.holidayPay,
        gross: payrollData.gross,
        lateDeduction: payrollData.lateDeduction,
        absentDeduction: payrollData.absentDeduction,
        halfDayDeduction: payrollData.halfDayDeduction,
        leaveDeduction: payrollData.leaveDeduction,
        deductions: payrollData.totalDeductions,
        tax: payrollData.tax,
        advanceDeduction: payrollData.advanceDeduction,
        benefits: 0,
        net: payrollData.net,
        employerCost: payrollData.gross,
        workingDays: payrollData.workingDays,
        presentDays: payrollData.presentDays,
        absentDays: payrollData.absentDays,
        halfDays: payrollData.halfDays,
        paidLeaveDays: payrollData.paidLeaveDays,
        unpaidLeaveDays: payrollData.unpaidLeaveDays,
        totalHours: payrollData.totalHours,
        paymentStatus: "pending",
      },
    });
  }

  const payroll = await prisma.payroll.create({
    data: {
      workspaceId: (await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })).workspaceId,
      period: month,
      name: `Payroll ${month}`,
      status: "draft",
      grossTotal: payrollData.gross,
      deductionTotal: payrollData.totalDeductions,
      taxTotal: payrollData.tax,
      netTotal: payrollData.net,
      employerCostTotal: payrollData.gross,
      processedAt: new Date(),
      items: {
        create: {
          employeeId,
          baseSalary: payrollData.baseSalary,
          allowances: payrollData.allowances,
          bonuses: payrollData.bonuses,
          overtime: payrollData.overtimePay,
          overtimeHours: payrollData.overtimeHours,
          weekendPay: payrollData.weekendPay,
          holidayPay: payrollData.holidayPay,
          gross: payrollData.gross,
          lateDeduction: payrollData.lateDeduction,
          absentDeduction: payrollData.absentDeduction,
          halfDayDeduction: payrollData.halfDayDeduction,
          leaveDeduction: payrollData.leaveDeduction,
          deductions: payrollData.totalDeductions,
          tax: payrollData.tax,
          advanceDeduction: payrollData.advanceDeduction,
          benefits: 0,
          net: payrollData.net,
          employerCost: payrollData.gross,
          workingDays: payrollData.workingDays,
          presentDays: payrollData.presentDays,
          absentDays: payrollData.absentDays,
          halfDays: payrollData.halfDays,
          paidLeaveDays: payrollData.paidLeaveDays,
          unpaidLeaveDays: payrollData.unpaidLeaveDays,
          totalHours: payrollData.totalHours,
          paymentStatus: "pending",
        },
      },
    },
    include: { items: true },
  });

  return payroll.items[0];
}

// ─── Get Employee Payslips ─────────────────────────────────────────────────

export async function getEmployeePayslips(employeeId: string) {
  return prisma.payrollItem.findMany({
    where: { employeeId },
    include: {
      payroll: {
        select: { period: true, name: true, status: true },
      },
    },
    orderBy: { payroll: { period: "desc" } },
  });
}

// ─── Payroll Summary ───────────────────────────────────────────────────────

export async function getPayrollSummary(workspaceId: string, month: string) {
  const payroll = await prisma.payroll.findFirst({
    where: { workspaceId, period: month },
    include: {
      items: {
        include: {
          employee: {
            select: { id: true, name: true, department: { select: { name: true } } },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });

  if (!payroll) return null;

  const items = payroll.items.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: item.employee.name,
    department: item.employee.department?.name ?? "—",
    baseSalary: item.baseSalary,
    allowances: item.allowances,
    bonuses: item.bonuses,
    overtime: item.overtime,
    overtimeHours: item.overtimeHours,
    gross: item.gross,
    deductions: item.deductions,
    tax: item.tax,
    advanceDeduction: item.advanceDeduction,
    lateDeduction: item.lateDeduction,
    absentDeduction: item.absentDeduction,
    halfDayDeduction: item.halfDayDeduction,
    leaveDeduction: item.leaveDeduction,
    net: item.net,
    presentDays: item.presentDays,
    absentDays: item.absentDays,
    halfDays: item.halfDays,
    workingDays: item.workingDays,
    paidLeaveDays: item.paidLeaveDays,
    unpaidLeaveDays: item.unpaidLeaveDays,
    totalHours: item.totalHours,
    weekendPay: item.weekendPay,
    holidayPay: item.holidayPay,
    paymentStatus: item.paymentStatus,
  }));

  return {
    payrollId: payroll.id,
    period: payroll.period,
    name: payroll.name,
    status: payroll.status,
    grossTotal: payroll.grossTotal,
    deductionTotal: payroll.deductionTotal,
    taxTotal: payroll.taxTotal,
    netTotal: payroll.netTotal,
    employerCostTotal: payroll.employerCostTotal,
    processedAt: payroll.processedAt,
    itemCount: items.length,
    items,
  };
}
