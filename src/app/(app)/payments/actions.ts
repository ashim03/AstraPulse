"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { z } from "zod";

async function requirePermission(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

const schema = z.object({
  direction: z.string().min(1),
  amount: z.coerce.number().positive("Enter a valid amount"),
  date: z.string().min(1, "Date is required"),
  method: z.string().min(1),
  invoiceId: z.string().optional().or(z.literal("")),
  expenseId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function recordPaymentAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payments", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;

  const invoice = d.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: d.invoiceId, workspaceId: session.workspaceId } })
    : null;
  const expense = d.expenseId
    ? await prisma.expense.findFirst({ where: { id: d.expenseId, workspaceId: session.workspaceId } })
    : null;

  const count = await prisma.payment.count({ where: { workspaceId: session.workspaceId } });
  const payment = await prisma.payment.create({
    data: {
      workspaceId: session.workspaceId,
      reference: `PAY-${String(count + 1).padStart(4, "0")}`,
      date: new Date(d.date),
      amount: d.amount,
      direction: d.direction,
      customerId: invoice?.customerId ?? null,
      vendorId: expense?.vendorId ?? null,
      invoiceId: invoice?.id ?? null,
      expenseId: expense?.id ?? null,
      method: d.method,
      notes: d.notes || null,
    },
  });

  if (invoice) {
    const newPaid = Math.round((invoice.paid + d.amount) * 100) / 100;
    const newStatus = newPaid >= invoice.total - 0.001 ? "paid" : "partially_paid";
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paid: newPaid, status: newStatus } });
  }
  if (expense) {
    await prisma.expense.update({ where: { id: expense.id }, data: { status: "paid" } });
  }

  await writeAudit({ session, action: "create", module: "payments", recordId: payment.id, description: `Recorded ${d.direction === "in" ? "incoming" : "outgoing"} payment of ${d.amount}` });
  revalidatePath("/payments");
  return ok(undefined, "Payment recorded");
}

export async function reconcilePaymentAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("payments", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const payment = await prisma.payment.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!payment) return fail("Payment not found");
  await prisma.payment.update({ where: { id }, data: { reconciled: true, reconciledAt: new Date() } });
  await writeAudit({ session, action: "update", module: "payments", recordId: id, description: `Reconciled ${payment.reference}` });
  revalidatePath("/payments");
  return ok(undefined, "Payment reconciled");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}