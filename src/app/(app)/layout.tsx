import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { logoutAction } from "../(auth)/actions";
import type { Notif } from "@/components/layout/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { workspace: { include: { subscription: true } }, role: true },
  });

  if (!user) return null;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const notifProps: Notif[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    link: n.link,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role?.name ?? undefined,
        onLogout: logoutAction,
      }}
      workspace={{
        name: user.workspace.name,
        plan: user.workspace.subscription?.plan,
        status: user.workspace.subscription?.status,
      }}
      notifications={notifProps}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}