"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";

export async function sendSuperAdminMessageAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const recipientIds = formData.getAll("recipients").map(String).filter(Boolean);
  if (!subject) return fail("Subject is required", { subject: "Subject is required" });
  if (recipientIds.length === 0) return fail("Select at least one recipient", { recipients: "Select at least one recipient" });

  const recipients = await prisma.user.findMany({ where: { id: { in: recipientIds } } });
  if (recipients.length === 0) return fail("No valid recipients found");

  const message = await prisma.message.create({
    data: {
      workspaceId: session.workspaceId,
      senderId: session.id,
      subject,
      body: body || null,
      recipients: { create: recipients.map((r) => ({ recipientId: r.id })) },
    },
  });

  for (const r of recipients) {
    await notify(r.workspaceId, r.id, "New message from Super Admin", subject, "/super-admin/messages");
  }

  await writeAudit({ session, action: "create", module: "mail", recordId: message.id, description: `Sent message to ${recipients.length} organization admin(s)` });
  revalidatePath("/super-admin/messages");
  return ok(undefined, "Message sent");
}

export async function markSuperAdminMessageReadAction(messageId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.messageRecipient.updateMany({
    where: { messageId, recipientId: session.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/super-admin/messages");
  return ok(undefined, "Marked read");
}

export async function deleteSuperAdminMessageAction(messageId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const recipientRecord = await prisma.messageRecipient.findFirst({
    where: { messageId, recipientId: session.id },
  });

  if (recipientRecord) {
    await prisma.messageRecipient.delete({ where: { id: recipientRecord.id } });
    revalidatePath("/super-admin/messages");
    return ok(undefined, "Message removed from inbox");
  }

  const message = await prisma.message.findFirst({ where: { id: messageId, senderId: session.id } });
  if (!message) return fail("Message not found");
  await prisma.message.delete({ where: { id: messageId } });
  await writeAudit({ session, action: "delete", module: "mail", recordId: messageId, description: `Deleted message: ${message.subject}` });
  revalidatePath("/super-admin/messages");
  return ok(undefined, "Message deleted");
}

export async function getSuperAdminConversationsAction(): Promise<ActionResult<any>> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const sentMessages = await prisma.message.findMany({
    where: { senderId: session.id },
    include: {
      recipients: { include: { recipient: { select: { id: true, name: true, email: true, workspaceId: true } } } },
      sender: { select: { id: true, name: true, email: true, workspaceId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const receivedMessages = await prisma.message.findMany({
    where: {
      recipients: { some: { recipientId: session.id } },
    },
    include: {
      recipients: { include: { recipient: { select: { id: true, name: true, email: true, workspaceId: true } } } },
      sender: { select: { id: true, name: true, email: true, workspaceId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allMessages = [...sentMessages, ...receivedMessages];
  const uniqueMessages = Array.from(new Map(allMessages.map((m) => [m.id, m])).values());

  return ok(uniqueMessages);
}

export async function getSuperAdminUnreadCountAction(): Promise<ActionResult<number>> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const count = await prisma.messageRecipient.count({
    where: { recipientId: session.id, readAt: null },
  });

  return ok(count);
}

export async function getOrganizationsAction(): Promise<ActionResult<any>> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const workspaces = await prisma.workspace.findMany({
    where: { status: "active" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return ok(workspaces);
}

export async function getSuperAdminRecipientsAction(): Promise<ActionResult<any>> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const admins = await prisma.user.findMany({
    where: {
      accountType: "organization",
      role: { name: "Workspace Admin" },
      status: "active",
    },
    select: { id: true, name: true, email: true, workspaceId: true },
  });

  const adminsWithWorkspace = await Promise.all(
    admins.map(async (admin) => {
      const ws = await prisma.workspace.findUnique({ where: { id: admin.workspaceId }, select: { name: true } });
      return { ...admin, workspaceName: ws?.name };
    })
  );

  return ok(adminsWithWorkspace);
}
