"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { z } from "zod";

const schema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  amount: z.coerce.number().positive("Enter a valid amount"),
  date: z.string().min(1, "Date is required"),
  months: z.coerce.number().int().min(1).max(24),
  reason: z.string().optional().or(z.literal("")),
});

export async function createAdvanceAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  const installment = Math.round((d.amount / d.months) * 100) / 100;
  const advance = await prisma.employeeAdvance.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId: d.employeeId,
      amount: d.amount,
      date: new Date(d.date),
      months: d.months,
      installment,
      outstanding: d.amount,
      reason: d.reason || null,
      status: "pending",
    },
  });
  await writeAudit({ session, action: "create", module: "advances", recordId: advance.id, description: `Advance of ${d.amount} for ${d.months} month(s)` });
  revalidatePath("/advances");
  return ok(undefined, "Advance requested");
}

export async function reviewAdvanceAction(id: string, status: "approved" | "rejected"): Promise<ActionResult> {
  const session = await requireSession();
  const advance = await prisma.employeeAdvance.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!advance) return fail("Advance not found");
  await prisma.employeeAdvance.update({
    where: { id },
    data: { status, approvedBy: status === "approved" ? session.id : null, approvedAt: status === "approved" ? new Date() : null },
  });
  await writeAudit({ session, action: status, module: "advances", recordId: id, description: `${status} advance of ${advance.amount}` });
  revalidatePath("/advances");
  return ok(undefined, status === "approved" ? "Advance approved" : "Advance rejected");
}

export async function deleteAdvanceAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const advance = await prisma.employeeAdvance.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!advance) return fail("Advance not found");
  await prisma.employeeAdvance.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "advances", recordId: id, description: `Deleted advance of ${advance.amount}` });
  revalidatePath("/advances");
  return ok(undefined, "Advance deleted");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}