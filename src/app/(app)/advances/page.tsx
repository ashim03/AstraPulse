import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDataScope, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { AdvanceManager, type EmployeeOption } from "./advance-manager";

export const dynamic = "force-dynamic";

export default async function AdvancesPage() {
  const session = await requireSession();
  if (!hasPermission(session, "advances", "view")) {
    redirect("/?error=access_denied");
  }
  const scope = getDataScope(session);

  const advanceWhere: Record<string, unknown> = { workspaceId: session.workspaceId };
  if (scope === "self") {
    advanceWhere.employeeId = session.employeeId;
  } else if (scope === "department" && session.departmentId) {
    advanceWhere.employee = { departmentId: session.departmentId };
  }

  const [advances, employees] = await Promise.all([
    prisma.employeeAdvance.findMany({
      where: advanceWhere,
      orderBy: { date: "desc" },
      include: { employee: { select: { id: true, name: true } } },
    }),
    prisma.employee.findMany({
      where: { workspaceId: session.workspaceId, status: { in: ["active", "probation"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = advances.map((a) => ({
    id: a.id,
    employee: a.employee.name,
    date: a.date.toISOString().slice(0, 10),
    amount: a.amount,
    months: a.months,
    installment: a.installment,
    outstanding: a.outstanding,
    status: a.status,
    reason: a.reason ?? "",
  }));

  const totalOutstanding = advances.filter((a) => a.status !== "rejected").reduce((s, a) => s + a.outstanding, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Advances"
        subtitle="Salary advances requested by employees, recovered via monthly installments."
        breadcrumb={"Payroll"}
      />
      <AdvanceManager
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, name: e.name })) as EmployeeOption[]}
        totalOutstanding={totalOutstanding}
      />
    </div>
  );
}