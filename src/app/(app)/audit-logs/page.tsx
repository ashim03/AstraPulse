import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { Tabs } from "@/components/ui/tabs";
import { AuthAuditClient } from "./auth-audit-client";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { module?: string; tab?: string };
}) {
  const session = await requireSession();
  const activeTab = searchParams.tab === "auth" ? "auth" : "general";

  if (activeTab === "auth") {
    const authLogs = await prisma.authAuditLog.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const serialized = authLogs.map((l) => ({
      id: l.id,
      email: l.email,
      action: l.action,
      success: l.success,
      ip: l.ip,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    }));

    return (
      <div className="space-y-6">
        <PageHeader title="Audit Logs" subtitle="A trail of every important action in the workspace." breadcrumb="Company" />
        <TabsComponent activeTab="auth" />
        <AuthAuditClient logs={serialized} />
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      workspaceId: session.workspaceId,
      ...(searchParams.module ? { module: searchParams.module } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true } } },
  });

  const modules = await prisma.auditLog.findMany({
    where: { workspaceId: session.workspaceId },
    distinct: ["module"],
    select: { module: true },
    orderBy: { module: "asc" },
  });

  const rows: SmartRow[] = logs.map((l) => ({
    id: l.id,
    time: l.createdAt.toISOString(),
    user: l.user?.name ?? "System",
    action: l.action,
    module: l.module,
    description: l.description,
  }));

  const columns: SmartColumn[] = [
    { key: "time", header: "When", kind: "datetime" },
    { key: "user", header: "User", kind: "avatar" },
    { key: "action", header: "Action", kind: "badge" },
    { key: "module", header: "Module" },
    { key: "description", header: "Description", minWidth: 300 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="A trail of every important action in the workspace." breadcrumb="Company" />
      <TabsComponent activeTab="general" />
      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["user", "action", "module", "description"]}
        searchPlaceholder="Search logs..."
        filters={[{ key: "module", label: "Module", options: modules.map((m) => ({ value: m.module, label: m.module })) }]}
        pageSize={25}
        emptyTitle="No audit logs"
        emptyDescription="Actions performed in this workspace will appear here."
      />
    </div>
  );
}

function TabsComponent({ activeTab }: { activeTab: string }) {
  const tabUrl = (tab: string) => `/audit-logs?tab=${tab}`;
  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      <a
        href={tabUrl("general")}
        className={`relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition min-h-[44px] ${
          activeTab === "general"
            ? "border-brand-600 text-brand-700"
            : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"
        }`}
      >
        General
      </a>
      <a
        href={tabUrl("auth")}
        className={`relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition min-h-[44px] ${
          activeTab === "auth"
            ? "border-brand-600 text-brand-700"
            : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"
        }`}
      >
        Authentication
      </a>
    </div>
  );
}
