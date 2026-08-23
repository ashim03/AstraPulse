"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";

export async function sendMessageAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }
  if (!hasPermission(session, "mail", "create")) {
    await writeAudit({ session, action: "denied", module: "mail", description: "Permission denied: mail:create" });
    return fail("You don't have permission to send messages");
  }
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
    if (r.id !== session.id) {
      await notify(r.workspaceId, r.id, "New message", subject, "/mail");
    }
  }

  await writeAudit({ session, action: "create", module: "mail", recordId: message.id, description: `Sent message to ${recipients.length} recipient(s)` });
  revalidatePath("/mail");
  return ok(undefined, "Message sent");
}

export async function markMessageReadAction(messageId: string): Promise<ActionResult> {
  const session = await requireSession();
  await prisma.messageRecipient.updateMany({
    where: { messageId, recipientId: session.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mail");
  return ok(undefined, "Marked read");
}

export async function deleteMessageAction(messageId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }
  if (!hasPermission(session, "mail", "delete")) {
    await writeAudit({ session, action: "denied", module: "mail", recordId: messageId, description: "Permission denied: mail:delete" });
    return fail("You don't have permission to delete messages");
  }

  const recipientRecord = await prisma.messageRecipient.findFirst({
    where: { messageId, recipientId: session.id },
  });

  if (recipientRecord) {
    await prisma.messageRecipient.delete({ where: { id: recipientRecord.id } });
    revalidatePath("/mail");
    return ok(undefined, "Message removed from inbox");
  }

  const message = await prisma.message.findFirst({ where: { id: messageId, senderId: session.id } });
  if (!message) return fail("Message not found");
  await prisma.message.delete({ where: { id: messageId } });
  await writeAudit({ session, action: "delete", module: "mail", recordId: messageId, description: `Deleted message: ${message.subject}` });
  revalidatePath("/mail");
  return ok(undefined, "Message deleted");
}

export async function getConversationsAction(): Promise<ActionResult<any>> {
  const session = await requireSession();

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

export async function getUnreadCountAction(): Promise<ActionResult<number>> {
  const session = await requireSession();

  const count = await prisma.messageRecipient.count({
    where: { recipientId: session.id, readAt: null },
  });

  return ok(count);
}

export async function getAvailableRecipientsAction(): Promise<ActionResult<any>> {
  const session = await requireSession();

  if (session.accountType === "super_admin") {
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

  const users = await prisma.user.findMany({
    where: {
      workspaceId: session.workspaceId,
      id: { not: session.id },
      status: "active",
    },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
  });

  return ok(users);
}
