import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PreviewClient } from "./preview-client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PayrollPreviewPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const session = await requireSession();

  if (!hasPermission(session, "payroll", "preview")) {
    redirect("/?error=access_denied");
  }

  const now = new Date();
  const startDate = searchParams.start
    ? new Date(searchParams.start)
    : startOfMonth(now);
  const endDate = searchParams.end
    ? new Date(searchParams.end)
    : endOfMonth(now);

  const employees = await prisma.employee.findMany({
    where: { workspaceId: session.workspaceId, status: { in: ["active", "on_leave"] } },
    include: {
      department: { select: { id: true, name: true } },
      salaryComponents: true,
    },
    orderBy: { name: "asc" },
  });

  const departments = await prisma.department.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { name: "asc" },
  });

  const periods = await prisma.payrollPeriod.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { startDate: "desc" },
  });

  const previewData = employees.map((emp) => {
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      departmentName: emp.department?.name ?? "—",
      baseSalary: emp.baseSalary,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Preview"
        subtitle="Preview salary calculations before generating payroll."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <a href="/payroll" className="font-medium hover:text-brand-600">Payroll</a>
            <span>/</span>
            <span className="font-semibold text-slate-700">Preview</span>
          </nav>
        }
      />
      <PreviewClient
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeId: e.employeeId,
          departmentName: e.department?.name ?? "—",
          departmentId: e.departmentId,
          baseSalary: e.baseSalary,
          salaryType: e.salaryType,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        periods={periods.map((p) => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
          paymentDate: p.paymentDate.toISOString(),
          status: p.status,
        }))}
        initialStart={startDate.toISOString()}
        initialEnd={endDate.toISOString()}
      />
    </div>
  );
}
