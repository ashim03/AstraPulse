import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { MailManager, type UserOption } from "./mail-manager";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const session = await requireSession();
  const [messages, users] = await Promise.all([
    prisma.message.findMany({
      where: {
        workspaceId: session.workspaceId,
        OR: [{ senderId: session.id }, { recipients: { some: { recipientId: session.id } } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true } },
        recipients: { include: { recipient: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { workspaceId: session.workspaceId, status: "active" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = messages.map((m) => {
    const mine = m.senderId === session.id;
    const readByMe = !mine && m.recipients.some((r) => r.recipientId === session.id && r.readAt);
    return {
      id: m.id,
      subject: m.subject,
      body: m.body ?? "",
      sender: m.sender.name,
      mine,
      unread: !mine && !readByMe,
      recipients: m.recipients.map((r) => r.recipient.name).join(", "),
      date: m.createdAt.toISOString().slice(0, 10),
      time: m.createdAt.toISOString().slice(11, 16),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Internal Mail" subtitle="Messages between team members." breadcrumb="Company" />
      <MailManager rows={rows} users={users.map((u) => ({ id: u.id, name: u.name, email: u.email })) as UserOption[]} meId={session.id} />
    </div>
  );
}