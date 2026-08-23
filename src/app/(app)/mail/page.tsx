import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { MessageManager, type UserOption, type MessageRow } from "./message-manager";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const session = await requireSession();
  if (!hasPermission(session, "mail", "view")) redirect("/?error=access_denied");
  const [messages, users, unreadCount] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [{ senderId: session.id }, { recipients: { some: { recipientId: session.id } } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, email: true, workspaceId: true } },
        recipients: { include: { recipient: { select: { id: true, name: true, email: true, workspaceId: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { workspaceId: session.workspaceId, status: "active" },
      select: { id: true, name: true, email: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.messageRecipient.count({
      where: { recipientId: session.id, readAt: null },
    }),
  ]);

  const rows: MessageRow[] = messages.map((m) => {
    const mine = m.senderId === session.id;
    const readByMe = !mine && m.recipients.some((r) => r.recipientId === session.id && r.readAt);
    return {
      id: m.id,
      subject: m.subject,
      body: m.body ?? "",
      senderId: m.senderId,
      sender: m.sender.name,
      senderEmail: m.sender.email,
      mine,
      unread: !mine && !readByMe,
      recipients: m.recipients.map((r) => r.recipient.name).join(", "),
      recipientIds: m.recipients.map((r) => r.recipientId),
      date: m.createdAt.toISOString().slice(0, 10),
      time: m.createdAt.toISOString().slice(11, 16),
      createdAt: m.createdAt,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal Mail"
        subtitle="Messages between team members."
        breadcrumb="Company"
        actions={
          <span className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
          </span>
        }
      />
      <MessageManager
        rows={rows}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })) as UserOption[]}
        meId={session.id}
        unreadCount={unreadCount}
      />
    </div>
  );
}
