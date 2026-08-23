"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, canAccessEmployee, type PermissionAction } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";
import { computeLeaveBalance } from "@/services/leave";
import { differenceInCalendarDays } from "date-fns";
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
  typeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional().or(z.literal("")),
});

export async function createLeaveRequestAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("leave", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;

  // Employees can only create leave requests for themselves
  if (session.employeeId && d.employeeId !== session.employeeId) {
    const hasManagePerm = hasPermission(session, "leave", "approve");
    if (!hasManagePerm) {
      await writeAudit({ session, action: "denied", module: "leave", description: "Permission denied: employees can only create leave for self" });
      return fail("You can only create leave requests for yourself");
    }
  }

  const start = new Date(d.startDate);
  const end = new Date(d.endDate);
  if (end < start) return fail("End date must be after start date", { endDate: "Invalid range" });
  const days = differenceInCalendarDays(end, start) + 1;

  const type = await prisma.leaveType.findFirst({ where: { id: d.typeId, workspaceId: session.workspaceId } });
  const employee = await prisma.employee.findFirst({ where: { id: d.employeeId, workspaceId: session.workspaceId } });
  if (!type || !employee) return fail("Leave type or employee not found");

  const balances = await computeLeaveBalance(session.workspaceId, employee.id, start.getFullYear());
  const balance = balances.find((b) => b.typeId === type.id);
  if (balance && days > balance.remaining) {
    return fail(`Only ${balance.remaining} day(s) of ${type.name} available`, { typeId: "Insufficient balance" });
  }

  const request = await prisma.leaveRequest.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId: employee.id,
      typeId: type.id,
      startDate: start,
      endDate: end,
      days,
      reason: d.reason || null,
      status: "pending",
    },
  });

  await writeAudit({ session, action: "create", module: "leave", recordId: request.id, description: `${employee.name} requested ${days}d ${type.name}` });

  const admins = await prisma.user.findMany({
    where: { workspaceId: session.workspaceId, role: { name: { in: ["Workspace Admin", "HR Manager"] } } },
  });
  for (const admin of admins) {
    await notify(session.workspaceId, admin.id, "New leave request", `${employee.name} requested ${days} day(s) of ${type.name}.`, "/leave");
  }

  revalidatePath("/leave");
  return ok(undefined, "Leave request submitted");
}

export async function approveLeaveRequestAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("leave", "approve");
  } catch {
    return fail("You don't have permission");
  }
  const request = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { employee: { include: { user: true } } },
  });
  if (!request) return fail("Request not found");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "approved", approverId: session.id, approvedAt: new Date() } });
  await prisma.employee.update({ where: { id: request.employeeId }, data: { status: "on_leave" } });
  await writeAudit({ session, action: "approve", module: "leave", recordId: id, description: `Approved ${request.days}d leave for ${request.employee.name}` });
  if (request.employee.user) {
    await notify(session.workspaceId, request.employee.user.id, "Leave approved", `Your ${request.days} day(s) leave request was approved.`, "/leave");
  }
  revalidatePath("/leave");
  return ok(undefined, "Request approved");
}

export async function rejectLeaveRequestAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("leave", "approve");
  } catch {
    return fail("You don't have permission");
  }
  const request = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { employee: { include: { user: true } } },
  });
  if (!request) return fail("Request not found");
  await prisma.leaveRequest.update({ where: { id }, data: { status: "rejected", approverId: session.id, approvedAt: new Date() } });
  await writeAudit({ session, action: "approve", module: "leave", recordId: id, description: `Rejected leave request for ${request.employee.name}` });
  if (request.employee.user) {
    await notify(session.workspaceId, request.employee.user.id, "Leave rejected", `Your ${request.days} day(s) leave request was rejected.`, "/leave");
  }
  revalidatePath("/leave");
  return ok(undefined, "Request rejected");
}

export async function cancelLeaveRequestAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("leave", "create");
  } catch {
    return fail("You don't have permission");
  }
  const request = await prisma.leaveRequest.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!request) return fail("Request not found");
  // Employees can only cancel their own requests
  if (session.employeeId && request.employeeId !== session.employeeId) {
    const hasApprovePerm = hasPermission(session, "leave", "approve");
    if (!hasApprovePerm) {
      await writeAudit({ session, action: "denied", module: "leave", recordId: id, description: "Permission denied: cannot cancel another employee's leave" });
      return fail("You can only cancel your own leave requests");
    }
  }
  await prisma.leaveRequest.update({ where: { id }, data: { status: "cancelled" } });
  await writeAudit({ session, action: "edit", module: "leave", recordId: id, description: `Cancelled leave request` });
  revalidatePath("/leave");
  return ok(undefined, "Request cancelled");
}

export async function createLeaveTypeAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("leave", "manage");
  } catch {
    return fail("You don't have permission");
  }
  const name = String(formData.get("name") ?? "").trim();
  const daysPerYear = Number(formData.get("daysPerYear") ?? 0);
  if (!name) return fail("Leave type name is required", { name: "Required" });
  const existing = await prisma.leaveType.findFirst({ where: { workspaceId: session.workspaceId, name } });
  if (existing) return fail("Leave type already exists", { name: "Already exists" });
  await prisma.leaveType.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      daysPerYear,
      carryForward: formData.get("carryForward") === "on",
      color: String(formData.get("color") ?? "#6366f1"),
    },
  });
  await writeAudit({ session, action: "create", module: "leave", description: `Created leave type ${name}` });
  revalidatePath("/leave");
  return ok(undefined, "Leave type created");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}