import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SuperAdminMessageManager, type RecipientOption, type Organization, type MessageRow } from "./message-manager";

export const dynamic = "force-dynamic";

export default async function SuperAdminMessagesPage() {
  const session = await requireSession();
  if (session.accountType !== "super_admin") {
    return null;
  }

  const [messages, recipients, organizations, unreadCount] = await Promise.all([
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
      where: {
        accountType: "organization",
        role: { name: "Workspace Admin" },
        status: "active",
      },
      select: { id: true, name: true, email: true, workspaceId: true },
    }),
    prisma.workspace.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.messageRecipient.count({
      where: { recipientId: session.id, readAt: null },
    }),
  ]);

  const recipientsWithWorkspace = await Promise.all(
    recipients.map(async (r) => {
      const ws = await prisma.workspace.findUnique({ where: { id: r.workspaceId }, select: { name: true } });
      return { ...r, workspaceName: ws?.name };
    })
  );

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
      senderWorkspaceId: m.sender.workspaceId,
      recipientWorkspaceIds: m.recipients.map((r) => r.recipient.workspaceId),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Communicate with organization administrators."
        breadcrumb="Super Admin"
        actions={
          <span className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
          </span>
        }
      />
      <SuperAdminMessageManager
        rows={rows}
        recipients={recipientsWithWorkspace as RecipientOption[]}
        organizations={organizations as Organization[]}
        meId={session.id}
        unreadCount={unreadCount}
      />
    </div>
  );
}
