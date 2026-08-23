import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, parsePermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsManager } from "./settings-manager";
import { SettingsNav } from "./settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "settings", "view")) {
    redirect("/?error=access_denied");
  }

  const [workspace, user] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.user.findUnique({ where: { id: session.id }, include: { role: true } }),
  ]);

  const rolePermissions = parsePermissions(user?.role?.permissions ?? "[]");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your workspace and profile." breadcrumb="Company" />
      <SettingsNav permissions={rolePermissions} />
      <SettingsManager
        workspace={{
          name: workspace?.name ?? "",
          email: workspace?.email ?? "",
          phone: workspace?.phone ?? "",
          country: workspace?.country ?? "",
          currency: workspace?.currency ?? "NPR",
          timezone: workspace?.timezone ?? "America/New_York",
          dateFormat: workspace?.dateFormat ?? "MM/DD/YYYY",
          fiscalYearStart: workspace?.fiscalYearStart ?? 1,
        }}
        profile={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
    </div>
  );
}
