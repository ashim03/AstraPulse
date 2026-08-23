import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PeriodManager } from "./period-manager";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PayrollPeriodsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "payroll", "periods")) {
    redirect("/?error=access_denied");
  }

  const periods = await prisma.payrollPeriod.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { startDate: "desc" },
  });

  const rows = periods.map((p) => ({
    id: p.id,
    name: p.name,
    frequency: p.frequency,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    paymentDate: p.paymentDate.toISOString(),
    status: p.status,
    isCurrent: p.isCurrent,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Periods"
        subtitle="Manage payroll periods and their lifecycle."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <a href="/payroll" className="font-medium hover:text-brand-600">Payroll</a>
            <span>/</span>
            <span className="font-semibold text-slate-700">Periods</span>
          </nav>
        }
      />
      <PeriodManager rows={rows} workspaceId={session.workspaceId} />
    </div>
  );
}
