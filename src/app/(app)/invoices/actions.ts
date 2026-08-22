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
  customerId: z.string().min(1, "Customer is required"),
  date: z.string().min(1, "Date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  discount: z.coerce.number().min(0).default(0),
  terms: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  lineDescription: z.string().min(1, "Line description is required"),
  lineQuantity: z.coerce.number().min(1),
  lineUnitPrice: z.coerce.number().min(0),
  lineTax: z.coerce.number().min(0).default(0),
});

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("invoices", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;

  const lineAmount = d.lineQuantity * d.lineUnitPrice;
  const subtotal = lineAmount;
  const discount = Math.min(d.discount, subtotal);
  const tax = Math.round((subtotal - discount) * (d.lineTax / 100) * 100) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;

  const count = await prisma.invoice.count({ where: { workspaceId: session.workspaceId } });
  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: session.workspaceId,
      number: `INV-${String(count + 1).padStart(4, "0")}`,
      customerId: d.customerId,
      date: new Date(d.date),
      dueDate: new Date(d.dueDate),
      status: "draft",
      subtotal,
      discount,
      tax,
      total,
      paid: 0,
      terms: d.terms || null,
      notes: d.notes || null,
      items: {
        create: {
          description: d.lineDescription,
          quantity: d.lineQuantity,
          unitPrice: d.lineUnitPrice,
          tax: d.lineTax,
          amount: lineAmount,
        },
      },
    },
  });
  await writeAudit({ session, action: "create", module: "invoices", recordId: invoice.id, description: `Created invoice ${invoice.number} for ${total}` });
  revalidatePath("/invoices");
  return ok(undefined, "Invoice created");
}

export async function updateInvoiceStatusAction(id: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("invoices", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const invoice = await prisma.invoice.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!invoice) return fail("Invoice not found");
  await prisma.invoice.update({ where: { id }, data: { status } });
  await writeAudit({ session, action: status, module: "invoices", recordId: id, description: `Invoice ${invoice.number} → ${status}` });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return ok(undefined, `Invoice marked ${status}`);
}

export async function recordInvoicePaymentAction(invoiceId: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("invoices", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, workspaceId: session.workspaceId } });
  if (!invoice) return fail("Invoice not found");
  const amount = z.coerce.number().positive().safeParse(formData.get("amount"));
  if (!amount.success) return fail("Enter a valid payment amount");
  const method = String(formData.get("method") ?? "bank_transfer");
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10));

  const remaining = Math.max(0, invoice.total - invoice.paid);
  const pay = Math.min(amount.data, remaining);
  if (pay <= 0) return fail("Invoice is fully paid");

  const count = await prisma.payment.count({ where: { workspaceId: session.workspaceId } });
  await prisma.payment.create({
    data: {
      workspaceId: session.workspaceId,
      reference: `PAY-${String(count + 1).padStart(4, "0")}`,
      date: new Date(date),
      amount: pay,
      direction: "in",
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      method,
      notes: `Payment on ${invoice.number}`,
    },
  });

  const newPaid = Math.round((invoice.paid + pay) * 100) / 100;
  const newStatus = newPaid >= invoice.total - 0.001 ? "paid" : "partially_paid";
  await prisma.invoice.update({ where: { id: invoice.id }, data: { paid: newPaid, status: newStatus } });

  await writeAudit({ session, action: "create", module: "payments", recordId: invoice.id, description: `Received ${pay} on ${invoice.number}` });
  revalidatePath(`/invoices/${invoiceId}`);
  return ok(undefined, "Payment recorded");
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("invoices", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const invoice = await prisma.invoice.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!invoice) return fail("Invoice not found");
  await prisma.invoice.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "invoices", recordId: id, description: `Deleted invoice ${invoice.number}` });
  revalidatePath("/invoices");
  return ok(undefined, "Invoice deleted");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}