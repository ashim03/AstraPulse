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
  employeeId: z.string().min(1, "Employee is required"),
  project: z.string().min(1, "Project is required"),
  date: z.string().min(1, "Date is required"),
  hours: z.coerce.number().min(0.25, "Enter valid hours").max(24, "Hours too high"),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  billable: z.string().optional(),
});

export async function createWorkRecordAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("work-records", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  const record = await prisma.workRecord.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId: d.employeeId,
      project: d.project,
      date: new Date(d.date),
      hours: d.hours,
      startTime: d.startTime || null,
      endTime: d.endTime || null,
      description: d.description || null,
      billable: d.billable === "on",
      status: "pending",
    },
  });
  await writeAudit({ session, action: "create", module: "work-records", recordId: record.id, description: `Logged ${d.hours}h on ${d.project}` });
  revalidatePath("/work-records");
  return ok(undefined, "Work record created");
}

export async function approveWorkRecordAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("work-records", "approve");
  } catch {
    return fail("You don't have permission");
  }
  const record = await prisma.workRecord.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!record) return fail("Record not found");
  await prisma.workRecord.update({ where: { id }, data: { status: "approved", approvedBy: session.id, approvedAt: new Date() } });
  await writeAudit({ session, action: "approve", module: "work-records", recordId: id, description: `Approved work record on ${record.project}` });
  revalidatePath("/work-records");
  return ok(undefined, "Record approved");
}

export async function deleteWorkRecordAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("work-records", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const record = await prisma.workRecord.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!record) return fail("Record not found");
  await prisma.workRecord.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "work-records", recordId: id, description: `Deleted work record on ${record.project}` });
  revalidatePath("/work-records");
  return ok(undefined, "Record deleted");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}