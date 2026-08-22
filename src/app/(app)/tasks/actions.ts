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
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  assigneeId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  priority: z.string().optional(),
  dueDate: z.string().optional().or(z.literal("")),
  status: z.string().optional(),
});

export async function createTaskAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("tasks", "create");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  const task = await prisma.task.create({
    data: {
      workspaceId: session.workspaceId,
      title: d.title,
      description: d.description || null,
      assigneeId: d.assigneeId || null,
      departmentId: d.departmentId || null,
      priority: d.priority || "medium",
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      status: d.status || "todo",
      createdBy: session.id,
    },
  });
  if (d.assigneeId) {
    const assignee = await prisma.employee.findFirst({ where: { id: d.assigneeId, workspaceId: session.workspaceId }, include: { user: true } });
    if (assignee?.user) await notify(session.workspaceId, assignee.user.id, "New task assigned", d.title, "/tasks");
  }
  await writeAudit({ session, action: "create", module: "tasks", recordId: task.id, description: `Created task "${task.title}"` });
  revalidatePath("/tasks");
  return ok(undefined, "Task created");
}

export async function updateTaskAction(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("tasks", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
  const d = parsed.data;
  const task = await prisma.task.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!task) return fail("Task not found");
  await prisma.task.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      assigneeId: d.assigneeId || null,
      departmentId: d.departmentId || null,
      priority: d.priority || "medium",
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      status: d.status || "todo",
    },
  });
  await writeAudit({ session, action: "edit", module: "tasks", recordId: id, description: `Updated task "${task.title}"` });
  revalidatePath("/tasks");
  return ok(undefined, "Task updated");
}

export async function updateTaskStatusAction(id: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("tasks", "edit");
  } catch {
    return fail("You don't have permission");
  }
  const task = await prisma.task.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!task) return fail("Task not found");
  await prisma.task.update({ where: { id }, data: { status } });
  await writeAudit({ session, action: "edit", module: "tasks", recordId: id, description: `Moved "${task.title}" to ${status.replace("_", " ")}` });
  revalidatePath("/tasks");
  return ok(undefined, "Task updated");
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("tasks", "delete");
  } catch {
    return fail("You don't have permission");
  }
  const task = await prisma.task.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!task) return fail("Task not found");
  await prisma.task.delete({ where: { id } });
  await writeAudit({ session, action: "delete", module: "tasks", recordId: id, description: `Deleted task "${task.title}"` });
  revalidatePath("/tasks");
  return ok(undefined, "Task deleted");
}

export async function addTaskCommentAction(taskId: string, comment: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePermission("tasks", "create");
  } catch {
    return fail("You don't have permission");
  }
  if (!comment.trim()) return fail("Comment cannot be empty");
  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId: session.workspaceId } });
  if (!task) return fail("Task not found");
  await prisma.taskComment.create({
    data: { taskId, userId: session.id, content: comment.trim() },
  });
  revalidatePath("/tasks");
  return ok(undefined, "Comment added");
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}