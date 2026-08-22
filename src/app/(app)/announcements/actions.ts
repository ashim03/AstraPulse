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
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  audience: z.string().default("all"),
  departmentId: z.string().optional().or(z.literal("")),
  priority: z.string().default("normal"),
  publishDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});

export async function createAnnouncementAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requirePermission("announcements", "create");
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail("Please fix the highlighted fields", toErrors(parsed.error));
    const d = parsed.data;
    const announcement = await prisma.announcement.create({
      data: {
        workspaceId: session.workspaceId,
        title: d.title,
        message: d.message,
        audience: d.audience,
        departmentId: d.departmentId || null,
        priority: d.priority,
        publishDate: d.publishDate ? new Date(d.publishDate) : null,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        status: "published",
        authorId: session.id,
      },
    });
    await writeAudit({ session, action: "create", module: "announcements", recordId: announcement.id, description: `Published announcement: ${d.title}` });
    revalidatePath("/announcements");
    return ok(undefined, "Announcement published");
  } catch (e) {
    return fail("Failed to create announcement. Please try again.");
  }
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("announcements", "delete");
    const announcement = await prisma.announcement.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!announcement) return fail("Announcement not found");
    await prisma.announcement.delete({ where: { id } });
    await writeAudit({ session, action: "delete", module: "announcements", recordId: id, description: `Deleted announcement: ${announcement.title}` });
    revalidatePath("/announcements");
    return ok(undefined, "Announcement deleted");
  } catch (e) {
    return fail("Failed to delete announcement. Please try again.");
  }
}

function toErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[issue.path[0]] = issue.message;
  return out;
}