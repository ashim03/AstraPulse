import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { logoutAction } from "../(auth)/actions";
import { parsePermissions } from "@/lib/permissions";
import type { Notif } from "@/components/layout/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { workspace: { include: { subscription: true } }, role: true },
  });

  if (!user) {
    redirect("/login");
  }

  // Parse permissions from the role
  const rolePermissions = parsePermissions(user.role?.permissions ?? "[]");
  const isAdmin = user.role?.name === "Workspace Admin";

  let notifProps: Notif[] = [];
  let unreadCount = 0;
  let unreadMessageCount = 0;

  try {
    const [notifications, msgCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.messageRecipient.count({
        where: { recipientId: user.id, readAt: null },
      }),
    ]);
    unreadCount = notifications.filter((n) => !n.readAt).length;
    unreadMessageCount = msgCount;

    notifProps = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      link: n.link,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));
  } catch {
    // Non-critical: continue without notifications
  }

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
        plan: user.workspace.subscription?.planName ?? undefined,
        status: user.workspace.subscription?.status ?? undefined,
      }}
      permissions={rolePermissions}
      showSubscription={isAdmin}
      notifications={notifProps}
      unreadCount={unreadCount}
      unreadMessageCount={unreadMessageCount}
    >
      {children}
    </AppShell>
  );
}