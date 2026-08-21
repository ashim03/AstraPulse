import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsManager } from "./settings-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const [workspace, user] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.user.findUnique({ where: { id: session.id } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your workspace and profile." breadcrumb="Company" />
      <SettingsManager
        workspace={{
          name: workspace?.name ?? "",
          email: workspace?.email ?? "",
          phone: workspace?.phone ?? "",
          country: workspace?.country ?? "",
          currency: workspace?.currency ?? "USD",
          timezone: workspace?.timezone ?? "America/New_York",
          dateFormat: workspace?.dateFormat ?? "MM/DD/YYYY",
          fiscalYearStart: workspace?.fiscalYearStart ?? 1,
        }}
        profile={{ name: user?.name ?? "", email: user?.email ?? "" }}
      />
    </div>
  );
}