import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayrollDetailManager } from "./payroll-detail";
import { money } from "@/lib/utils";
import { PAYROLL_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PayrollDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const payroll = await prisma.payroll.findFirst({
    where: { id: params.id, workspaceId: session.workspaceId },
    include: {
      items: {
        include: { employee: { select: { id: true, name: true, position: { select: { name: true } } } } },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!payroll) notFound();

  const rows = payroll.items.map((i) => ({
    id: i.id,
    employee: i.employee.name,
    position: i.employee.position?.name ?? "",
    baseSalary: i.baseSalary,
    allowances: i.allowances,
    bonuses: i.bonuses,
    overtime: i.overtime,
    gross: i.gross,
    deductions: i.deductions,
    tax: i.tax,
    advanceDeduction: i.advanceDeduction,
    net: i.net,
    paymentStatus: i.paymentStatus,
  }));

  const statusLabel = PAYROLL_STATUSES.find((s) => s.value === payroll.status)?.label ?? payroll.status;

  return (
    <div className="space-y-6">
      <PageHeader
        title={payroll.name}
        subtitle={`Period ${payroll.period} • ${statusLabel}`}
        breadcrumb={<>{"Payroll"} / {payroll.period}</>}
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Gross</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{money(payroll.grossTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Deductions + Tax</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{money(payroll.deductionTotal + payroll.taxTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Net pay</p>
          <p className="text-xl font-bold text-emerald-600">{money(payroll.netTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Employer cost</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{money(payroll.employerCostTotal)}</p>
        </Card>
      </div>

      <PayrollDetailManager payrollId={payroll.id} status={payroll.status} period={payroll.period} rows={rows} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Status:</span>
          <Badge>{statusLabel}</Badge>
          <span className="ml-2">Approved by: {payroll.approvedBy ?? "Not yet"}</span>
          <span>Processed: {payroll.processedAt ? payroll.processedAt.toLocaleDateString() : "—"}</span>
        </div>
      </Card>
    </div>
  );
}