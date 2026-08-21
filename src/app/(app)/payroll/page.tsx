import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PayrollManager } from "./payroll-manager";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const session = await requireSession();
  const payrolls = await prisma.payroll.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { period: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const rows = payrolls.map((p) => ({
    id: p.id,
    period: p.period,
    name: p.name,
    employees: p._count.items,
    grossTotal: p.grossTotal,
    deductionTotal: p.deductionTotal,
    taxTotal: p.taxTotal,
    netTotal: p.netTotal,
    status: p.status,
  }));

  const latestPeriod = payrolls[0]?.period ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Run monthly payroll, review employee payslips, and approve pay runs."
        breadcrumb={"Payroll"}
      />
      <PayrollManager rows={rows} latestPeriod={latestPeriod} />
    </div>
  );
}