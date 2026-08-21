import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({ searchParams }: { searchParams: { module?: string } }) {
  const session = await requireSession();
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