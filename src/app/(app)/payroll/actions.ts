"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { buildPayrollRun, calculateEmployeePayroll, generatePayslip, getEmployeePayslips, getPayrollSummary } from "@/services/payroll";
import { z } from "zod";

async function requirePermission(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function runPayrollAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "create");
  } catch {
    return fail("You don't have permission");
  }
  const period = String(formData.get("period") ?? "");
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("Period must be YYYY-MM");

  const existing = await prisma.payroll.findFirst({ where: { workspaceId: session.workspaceId, period } });
  if (existing) return fail(`Payroll for ${period} already exists`);

  const { items, totals } = await buildPayrollRun(session.workspaceId, period);
  if (items.length === 0) return fail("No active employees to pay");

  const payroll = await prisma.payroll.create({
    data: {
      workspaceId: session.workspaceId,
      period,
      name: `Payroll ${period}`,
      status: "calculated",
      grossTotal: Math.round(totals.gross * 100) / 100,
      deductionTotal: Math.round(totals.deductions * 100) / 100,
      taxTotal: Math.round(totals.tax * 100) / 100,
      netTotal: Math.round(totals.net * 100) / 100,
      employerCostTotal: Math.round(totals.employer * 100) / 100,
      processedAt: new Date(),
      items: { create: items },
    },
  });

  await writeAudit({ session, action: "create", module: "payroll", recordId: payroll.id, description: `Generated payroll ${period} (net ${payroll.netTotal})` });
  revalidatePath("/payroll");
  return ok(undefined, "Payroll generated");
}

export async function updatePayrollStatusAction(id: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "approve");
  } catch {
    return fail("You don't have permission");
  }
  const payroll = await prisma.payroll.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!payroll) return fail("Payroll not found");

  const data: Record<string, unknown> = { status };
  if (status === "approved") {
    data.approvedBy = session.id;
    data.approvedAt = new Date();
  }
  if (status === "paid" || status === "locked") data.lockedAt = new Date();
  if (status === "paid") {
    await prisma.employeeAdvance.updateMany({
      where: { workspaceId: session.workspaceId, status: "approved" },
      data: { status: "paid" },
    });
  }

  await prisma.payroll.update({ where: { id }, data });
  await writeAudit({ session, action: status, module: "payroll", recordId: id, description: `Payroll ${payroll.period} marked ${status}` });
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
  return ok(undefined, `Payroll marked ${status}`);
}

export async function generatePayrollPreviewAction(
  startDate: string,
  endDate: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "preview");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const { calculatePayrollPreview } = await import("@/services/salary");
    const preview = await calculatePayrollPreview(
      session.workspaceId,
      new Date(startDate),
      new Date(endDate)
    );
    return ok(preview);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to calculate preview";
    return fail(message);
  }
}

export async function generatePayrollFromPreviewAction(
  previewData: Array<{
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
  }>,
  period: { id: string; name: string; startDate: string; endDate: string }
): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "create");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const { generatePayrollFromPreview } = await import("@/services/salary");

    const payroll = await generatePayrollFromPreview(
      session.workspaceId,
      previewData,
      {
        id: period.id,
        name: period.name,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
      } as any
    );

    await writeAudit({
      session,
      action: "create",
      module: "payroll",
      recordId: payroll.id,
      description: `Generated payroll from preview (${payroll.items.length} employees, net ${payroll.netTotal})`,
    });

    revalidatePath("/payroll");
    revalidatePath("/payroll/preview");
    return ok(undefined, "Payroll generated successfully");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate payroll";
    return fail(message);
  }
}

export async function createPayrollPeriodAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "manage");
  } catch {
    return fail("You don't have permission");
  }

  const name = String(formData.get("name") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "monthly");
  const startDateStr = String(formData.get("startDate") ?? "");
  const endDateStr = String(formData.get("endDate") ?? "");
  const paymentDateStr = String(formData.get("paymentDate") ?? "");

  if (!name) return fail("Name is required");
  if (!startDateStr) return fail("Start date is required");
  if (!endDateStr) return fail("End date is required");
  if (!paymentDateStr) return fail("Payment date is required");

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const paymentDate = new Date(paymentDateStr);

  if (endDate <= startDate) return fail("End date must be after start date");

  const existing = await prisma.payrollPeriod.findFirst({
    where: {
      workspaceId: session.workspaceId,
      name,
    },
  });

  if (existing) return fail("A period with this name already exists");

  const period = await prisma.payrollPeriod.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      frequency,
      startDate,
      endDate,
      paymentDate,
      status: "upcoming",
      isCurrent: false,
    },
  });

  await writeAudit({
    session,
    action: "create",
    module: "payroll-period",
    recordId: period.id,
    description: `Created payroll period "${name}" (${frequency})`,
  });

  revalidatePath("/payroll/periods");
  return ok(undefined, "Period created");
}

export async function updatePayrollPeriodAction(
  id: string,
  status: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "manage");
  } catch {
    return fail("You don't have permission");
  }

  const period = await prisma.payrollPeriod.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });

  if (!period) return fail("Period not found");

  const validTransitions: Record<string, string[]> = {
    upcoming: ["active", "closed"],
    active: ["processing", "completed", "closed"],
    processing: ["completed", "closed"],
    completed: ["closed"],
    closed: [],
  };

  const allowed = validTransitions[period.status] ?? [];
  if (!allowed.includes(status)) {
    return fail(`Cannot transition from "${period.status}" to "${status}"`);
  }

  const updateData: Record<string, unknown> = { status };

  if (status === "active") {
    await prisma.payrollPeriod.updateMany({
      where: { workspaceId: session.workspaceId, isCurrent: true },
      data: { isCurrent: false },
    });
    updateData.isCurrent = true;
  }

  if (status === "closed") {
    updateData.isCurrent = false;
  }

  await prisma.payrollPeriod.update({ where: { id }, data: updateData });

  await writeAudit({
    session,
    action: status,
    module: "payroll-period",
    recordId: id,
    description: `Period "${period.name}" marked as ${status}`,
  });

  revalidatePath("/payroll/periods");
  return ok(undefined, `Period ${status}`);
}

export async function runAutoSalaryAction(periodId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "create");
  } catch {
    return fail("You don't have permission");
  }

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, workspaceId: session.workspaceId },
  });

  if (!period) return fail("Period not found");

  if (period.status !== "active") {
    return fail("Period must be active to process payroll");
  }

  const existingPayroll = await prisma.payroll.findFirst({
    where: {
      workspaceId: session.workspaceId,
      period: `${period.startDate.toISOString().slice(0, 7)}`,
    },
  });

  if (existingPayroll) {
    return fail("Payroll already exists for this period");
  }

  try {
    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "processing" },
    });

    const { calculatePayrollPreview, generatePayrollFromPreview } = await import("@/services/salary");

    const preview = await calculatePayrollPreview(
      session.workspaceId,
      period.startDate,
      period.endDate
    );

    if (preview.length === 0) {
      await prisma.payrollPeriod.update({
        where: { id: periodId },
        data: { status: "active" },
      });
      return fail("No active employees to pay");
    }

    const payroll = await generatePayrollFromPreview(
      session.workspaceId,
      preview,
      period
    );

    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "completed" },
    });

    await writeAudit({
      session,
      action: "process",
      module: "payroll",
      recordId: payroll.id,
      description: `Auto-generated payroll for period "${period.name}" (${payroll.items.length} employees)`,
    });

    revalidatePath("/payroll");
    revalidatePath("/payroll/periods");
    return ok(undefined, "Payroll generated");
  } catch (e) {
    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "active" },
    });
    const message = e instanceof Error ? e.message : "Failed to generate payroll";
    return fail(message);
  }
}

// ─── New Actions ───────────────────────────────────────────────────────────

export async function generatePayrollAction(month: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "create");
  } catch {
    return fail("You don't have permission");
  }

  if (!/^\d{4}-\d{2}$/.test(month)) return fail("Month must be YYYY-MM");

  const existing = await prisma.payroll.findFirst({
    where: { workspaceId: session.workspaceId, period: month },
  });
  if (existing) return fail(`Payroll for ${month} already exists`);

  const employees = await prisma.employee.findMany({
    where: { workspaceId: session.workspaceId, status: { in: ["active", "on_leave"] } },
    select: { id: true },
  });

  if (employees.length === 0) return fail("No active employees");

  const payrollDataList: Array<Awaited<ReturnType<typeof calculateEmployeePayroll>>> = [];
  for (const emp of employees) {
    try {
      const data = await calculateEmployeePayroll(emp.id, month);
      payrollDataList.push(data);
    } catch {
      // skip employees that fail calculation
    }
  }

  if (payrollDataList.length === 0) return fail("Failed to calculate payroll for any employee");

  const totals = payrollDataList.reduce(
    (acc, d) => ({
      gross: acc.gross + d.gross,
      deductions: acc.deductions + d.totalDeductions + d.advanceDeduction,
      tax: acc.tax + d.tax,
      net: acc.net + d.net,
    }),
    { gross: 0, deductions: 0, tax: 0, net: 0 }
  );

  const payroll = await prisma.payroll.create({
    data: {
      workspaceId: session.workspaceId,
      period: month,
      name: `Payroll ${month}`,
      status: "calculated",
      grossTotal: Math.round(totals.gross * 100) / 100,
      deductionTotal: Math.round(totals.deductions * 100) / 100,
      taxTotal: Math.round(totals.tax * 100) / 100,
      netTotal: Math.round(totals.net * 100) / 100,
      employerCostTotal: Math.round(totals.gross * 100) / 100,
      processedAt: new Date(),
      items: {
        create: payrollDataList.map((d) => ({
          employeeId: d.employeeId,
          baseSalary: d.baseSalary,
          allowances: d.allowances,
          bonuses: d.bonuses,
          overtime: d.overtimePay,
          overtimeHours: d.overtimeHours,
          weekendPay: d.weekendPay,
          holidayPay: d.holidayPay,
          gross: d.gross,
          lateDeduction: d.lateDeduction,
          absentDeduction: d.absentDeduction,
          halfDayDeduction: d.halfDayDeduction,
          leaveDeduction: d.leaveDeduction,
          deductions: d.totalDeductions,
          tax: d.tax,
          advanceDeduction: d.advanceDeduction,
          benefits: 0,
          net: d.net,
          employerCost: d.gross,
          workingDays: d.workingDays,
          presentDays: d.presentDays,
          absentDays: d.absentDays,
          halfDays: d.halfDays,
          paidLeaveDays: d.paidLeaveDays,
          unpaidLeaveDays: d.unpaidLeaveDays,
          totalHours: d.totalHours,
          paymentStatus: "pending",
        })),
      },
    },
  });

  await writeAudit({
    session,
    action: "create",
    module: "payroll",
    recordId: payroll.id,
    description: `Generated payroll ${month} (${payrollDataList.length} employees, net ${payroll.netTotal})`,
  });

  revalidatePath("/payroll");
  return ok({
    payrollId: payroll.id,
    employeeCount: payrollDataList.length,
    netTotal: payroll.netTotal,
  }, "Payroll generated successfully");
}

export async function getPayrollAction(month: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "view");
  } catch {
    return fail("You don't have permission");
  }

  const summary = await getPayrollSummary(session.workspaceId, month);
  return ok(summary);
}

export async function getPayslipAction(payslipId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "view");
  } catch {
    return fail("You don't have permission");
  }

  const payslip = await prisma.payrollItem.findFirst({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
          bankName: true,
          bankAccountNumber: true,
          accountHolder: true,
          taxId: true,
        },
      },
      payroll: {
        select: { period: true, name: true, status: true },
      },
    },
  });

  if (!payslip) return fail("Payslip not found");

  return ok(payslip);
}

export async function getMyPayrollAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Not authenticated");
  }

  if (!session.employeeId) return fail("No employee profile found");

  const payslips = await getEmployeePayslips(session.employeeId);
  return ok(payslips);
}

export async function getPayrollSettingsAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "view");
  } catch {
    return fail("You don't have permission");
  }

  const settings = await prisma.attendanceSettings.findFirst({
    where: { workspaceId: session.workspaceId },
  });

  const salaryConfigs = await prisma.salaryConfig.findMany({
    where: { workspaceId: session.workspaceId },
  });

  return ok({
    attendanceSettings: settings,
    salaryConfigs,
  });
}

export async function updatePayrollSettingsAction(data: {
  lateDeductionPerMinute?: number;
  absentDeductionEnabled?: boolean;
  halfDayDeductionPercent?: number;
  overtimeRateMultiplier?: number;
  weekendOvertimeRate?: number;
  holidayOvertimeRate?: number;
  taxEnabled?: boolean;
  taxRate?: number;
}): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payroll", "manage");
  } catch {
    return fail("You don't have permission");
  }

  const attendanceUpdate: Record<string, unknown> = {};
  if (data.lateDeductionPerMinute !== undefined) attendanceUpdate.lateDeductionPerMinute = data.lateDeductionPerMinute;
  if (data.absentDeductionEnabled !== undefined) attendanceUpdate.absentDeductionEnabled = data.absentDeductionEnabled;
  if (data.halfDayDeductionPercent !== undefined) attendanceUpdate.halfDayDeductionPercent = data.halfDayDeductionPercent;
  if (data.overtimeRateMultiplier !== undefined) attendanceUpdate.overtimeRateMultiplier = data.overtimeRateMultiplier;
  if (data.weekendOvertimeRate !== undefined) attendanceUpdate.weekendOvertimeRate = data.weekendOvertimeRate;
  if (data.holidayOvertimeRate !== undefined) attendanceUpdate.holidayOvertimeRate = data.holidayOvertimeRate;

  if (Object.keys(attendanceUpdate).length > 0) {
    const existing = await prisma.attendanceSettings.findFirst({
      where: { workspaceId: session.workspaceId },
    });
    if (existing) {
      await prisma.attendanceSettings.update({
        where: { id: existing.id },
        data: attendanceUpdate,
      });
    }
  }

  if (data.taxEnabled !== undefined || data.taxRate !== undefined) {
    const salaryUpdate: Record<string, unknown> = {};
    if (data.taxEnabled !== undefined) salaryUpdate.taxEnabled = data.taxEnabled;
    if (data.taxRate !== undefined) salaryUpdate.taxRate = data.taxRate;

    await prisma.salaryConfig.updateMany({
      where: { workspaceId: session.workspaceId },
      data: salaryUpdate,
    });
  }

  await writeAudit({
    session,
    action: "update",
    module: "payroll-settings",
    description: "Updated payroll settings",
  });

  revalidatePath("/payroll");
  revalidatePath("/payroll/settings");
  return ok(undefined, "Payroll settings updated");
}
