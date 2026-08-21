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