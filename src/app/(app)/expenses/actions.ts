"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";
import { z } from "zod";

async function requirePermission(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

const schema = z.object({
  vendorName: z.string().optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Enter a valid amount"),
  tax: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("expenses", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;

  const vendorName = d.vendorName?.trim();
  const vendor = vendorName
    ? (await prisma.vendor.findFirst({ where: { workspaceId: session.workspaceId, name: vendorName } })) ??
      (await prisma.vendor.create({ data: { workspaceId: session.workspaceId, name: vendorName } }))
    : null;

  const count = await prisma.expense.count({ where: { workspaceId: session.workspaceId } });
  const expense = await prisma.expense.create({
    data: {
      workspaceId: session.workspaceId,
      number: `EXP-${String(count + 1).padStart(4, "0")}`,
      vendorId: vendor?.id ?? null,
      category: d.category,
      date: new Date(d.date),
      amount: d.amount,
      tax: d.tax,
      paymentMethod: d.paymentMethod || null,
      description: d.description || null,
      status: "submitted",
    },
  });
  await writeAudit({ session, action: "create", module: "expenses", recordId: expense.id, description: `Submitted expense ${expense.number} (${d.amount})` });
  revalidatePath("/expenses");
  return ok(undefined, "Expense submitted");
}

export async function updateExpenseStatusAction(id: string, status: "approved" | "paid" | "rejected"): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("expenses", "approve");
  } catch {
    return fail("You don't have permission");
  }
  const expense = await prisma.expense.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!expense) return fail("Expense not found");
  await prisma.expense.update({ where: { id }, data: { status } });
  await writeAudit({ session, action: status, module: "expenses", recordId: id, description: `Expense ${expense.number} ${status}` });
  revalidatePath("/expenses");
  return ok(undefined, `Expense ${status}`);
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("expenses", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const expense = await prisma.expense.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!expense) return fail("Expense not found");
  await prisma.expense.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "expenses", recordId: id, description: `Deleted expense ${expense.number}` });
  revalidatePath("/expenses");
  return ok(undefined, "Expense deleted");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}