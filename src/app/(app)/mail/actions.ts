"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";

export async function sendMessageAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const recipientIds = formData.getAll("recipients").map(String).filter(Boolean);
  if (!subject) return fail("Subject is required", { subject: "Subject is required" });
  if (recipientIds.length === 0) return fail("Select at least one recipient", { recipients: "Select at least one recipient" });

  const recipients = await prisma.user.findMany({ where: { id: { in: recipientIds }, workspaceId: session.workspaceId } });
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
      await notify(session.workspaceId, r.id, "New message", subject, "/mail");
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
  const session = await requireSession();
  const message = await prisma.message.findFirst({ where: { id: messageId, workspaceId: session.workspaceId } });
  if (!message) return fail("Message not found");
  await prisma.message.delete({ where: { id: messageId } });
  await writeAudit({ session, action: "delete", module: "mail", recordId: messageId, description: `Deleted message: ${message.subject}` });
  revalidatePath("/mail");
  return ok(undefined, "Message deleted");
}