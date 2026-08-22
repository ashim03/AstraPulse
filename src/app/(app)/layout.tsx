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
        plan: user.workspace.subscription?.plan ?? undefined,
        status: user.workspace.subscription?.status ?? undefined,
      }}
      permissions={rolePermissions}
      showSubscription={isAdmin}
      notifications={notifProps}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}