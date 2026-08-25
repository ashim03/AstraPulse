import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDataScope, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { WorkRecordManager, type EmployeeOption } from "./work-record-manager";

export const dynamic = "force-dynamic";

export default async function WorkRecordsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "work-records", "view")) {
    redirect("/?error=access_denied");
  }
  const scope = getDataScope(session);

  const recordWhere: Record<string, unknown> = { workspaceId: session.workspaceId };
  if (scope === "self") {
    recordWhere.employeeId = session.employeeId;
  } else if (scope === "department" && session.departmentId) {
    recordWhere.employee = { departmentId: session.departmentId };
  }

  const [records, employees] = await Promise.all([
    prisma.workRecord.findMany({
      where: recordWhere,
      orderBy: { date: "desc" },
      include: { employee: { select: { id: true, name: true } } },
    }),
    prisma.employee.findMany({
      where: { workspaceId: session.workspaceId, status: { in: ["active", "probation"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = records.map((r) => ({
    id: r.id,
    employee: r.employee.name,
    project: r.project,
    date: r.date.toISOString().slice(0, 10),
    hours: r.hours,
    billable: r.billable,
    status: r.status,
    description: r.description ?? "",
  }));

  const stats = {
    total: records.reduce((s, r) => s + r.hours, 0),
    billable: records.filter((r) => r.billable).reduce((s, r) => s + r.hours, 0),
    approved: records.filter((r) => r.status === "approved").reduce((s, r) => s + r.hours, 0),
    pending: records.filter((r) => r.status === "pending").reduce((s, r) => s + r.hours, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Records"
        subtitle="Track billable hours logged against projects by your team."
        breadcrumb={"HR"}
      />
      <WorkRecordManager
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, name: e.name })) as EmployeeOption[]}
        stats={stats}
        canApprove={hasPermission(session, "work-records", "approve")}
        canDelete={hasPermission(session, "work-records", "delete")}
      />
    </div>
  );
}