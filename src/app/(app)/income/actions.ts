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
  customerName: z.string().optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Enter a valid amount"),
  tax: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

export async function createIncomeAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("income", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;

  const customerName = d.customerName?.trim();
  const customer = customerName
    ? (await prisma.customer.findFirst({ where: { workspaceId: session.workspaceId, name: customerName } })) ??
      (await prisma.customer.create({ data: { workspaceId: session.workspaceId, name: customerName } }))
    : null;

  const count = await prisma.income.count({ where: { workspaceId: session.workspaceId } });
  const income = await prisma.income.create({
    data: {
      workspaceId: session.workspaceId,
      number: `INC-${String(count + 1).padStart(4, "0")}`,
      customerId: customer?.id ?? null,
      category: d.category,
      date: new Date(d.date),
      amount: d.amount,
      tax: d.tax,
      paymentMethod: d.paymentMethod || null,
      description: d.description || null,
    },
  });
  await writeAudit({ session, action: "create", module: "income", recordId: income.id, description: `Recorded income ${income.number} (${d.amount})` });
  revalidatePath("/income");
  return ok(undefined, "Income recorded");
}

export async function deleteIncomeAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("income", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const income = await prisma.income.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!income) return fail("Income not found");
  await prisma.income.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "income", recordId: id, description: `Deleted income ${income.number}` });
  revalidatePath("/income");
  return ok(undefined, "Income deleted");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}