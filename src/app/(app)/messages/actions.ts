"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify, ok, fail, type ActionResult } from "@/lib/actions";

export type MessageCategory = "attendance" | "leave" | "payroll" | "general";

export type MessageWithRelations = {
  id: string;
  subject: string;
  body: string | null;
  category: string;
  parentId: string | null;
  senderId: string;
  createdAt: Date;
  sender: { id: string; name: string; email: string };
  recipients: {
    recipientId: string;
    readAt: Date | null;
    recipient: { id: string; name: string; email: string };
  }[];
};

export async function sendMessageAction(
  recipientId: string,
  subject: string,
  body: string,
  category: MessageCategory = "general"
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();

  if (!trimmedSubject) return fail("Subject is required", { subject: "Subject is required" });
  if (!trimmedBody) return fail("Message body is required", { body: "Message body is required" });
  if (!recipientId) return fail("Recipient is required", { recipientId: "Recipient is required" });

  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, workspaceId: session.workspaceId },
  });
  if (!recipient) return fail("Recipient not found");

  const message = await prisma.message.create({
    data: {
      workspaceId: session.workspaceId,
      senderId: session.id,
      subject: trimmedSubject,
      body: trimmedBody,
      category,
      recipients: { create: [{ recipientId }] },
    },
  });

  if (recipientId !== session.id) {
    await notify(session.workspaceId, recipientId, "New message", trimmedSubject, "/messages");
  }

  revalidatePath("/messages");
  return ok(undefined, "Message sent");
}

export async function getMyMessagesAction(): Promise<ActionResult<MessageWithRelations[]>> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  const sent = await prisma.message.findMany({
    where: { senderId: session.id, workspaceId: session.workspaceId },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      recipients: {
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const received = await prisma.message.findMany({
    where: { workspaceId: session.workspaceId, recipients: { some: { recipientId: session.id } } },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      recipients: {
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const all = [...sent, ...received];
  const unique = Array.from(new Map(all.map((m) => [m.id, m])).values());

  return ok(unique);
}

export async function markAsReadAction(messageId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  await prisma.messageRecipient.updateMany({
    where: { messageId, recipientId: session.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/messages");
  return ok(undefined, "Marked as read");
}

export async function getUnreadCountAction(): Promise<ActionResult<number>> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  const count = await prisma.messageRecipient.count({
    where: { recipientId: session.id, readAt: null, message: { workspaceId: session.workspaceId } },
  });

  return ok(count);
}

export async function replyToMessageAction(
  parentMessageId: string,
  body: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) return fail("Reply body is required", { body: "Reply body is required" });

  const parent = await prisma.message.findUnique({
    where: { id: parentMessageId },
    include: {
      sender: { select: { id: true, name: true } },
      recipients: { select: { recipientId: true } },
    },
  });

  if (!parent) return fail("Original message not found");

  const replyRecipientId =
    parent.senderId === session.id
      ? parent.recipients.find((r) => r.recipientId !== session.id)?.recipientId ?? parent.senderId
      : parent.senderId;

  const reply = await prisma.message.create({
    data: {
      workspaceId: session.workspaceId,
      senderId: session.id,
      subject: `Re: ${parent.subject.replace(/^Re:\s*/i, "")}`,
      body: trimmedBody,
      category: parent.category,
      parentId: parentMessageId,
      recipients: { create: [{ recipientId: replyRecipientId }] },
    },
  });

  if (replyRecipientId !== session.id) {
    await notify(session.workspaceId, replyRecipientId, "New reply", reply.subject, "/messages");
  }

  revalidatePath("/messages");
  return ok(undefined, "Reply sent");
}

export async function getUsersAction(): Promise<ActionResult<{ id: string; name: string; email: string; role?: string }[]>> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }

  const users = await prisma.user.findMany({
    where: { workspaceId: session.workspaceId, id: { not: session.id }, status: "active" },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return ok(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role?.name })));
}

export async function getMyIdAction(): Promise<ActionResult<string>> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }
  return ok(session.id);
}
