"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { buildPayrollRun } from "@/services/payroll";
import { z } from "zod";

export async function runPayrollAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
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
  const session = await requireSession();
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