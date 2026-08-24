import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/permissions";
import { PayrollDashboard } from "./payroll-dashboard";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();
  if (!hasPermission(session, "payroll", "view")) {
    redirect("/?error=access_denied");
  }

  const month = typeof searchParams.month === "string"
    ? searchParams.month
    : new Date().toISOString().slice(0, 7);

  const payrolls = await prisma.payroll.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { period: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const payroll = await prisma.payroll.findFirst({
    where: { workspaceId: session.workspaceId, period: month },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });

  const items = payroll?.items.map((i) => ({
    id: i.id,
    employeeId: i.employeeId,
    employeeName: i.employee.name,
    department: i.employee.department?.name ?? "—",
    position: i.employee.position?.name ?? "",
    baseSalary: i.baseSalary,
    allowances: i.allowances,
    bonuses: i.bonuses,
    overtime: i.overtime,
    overtimeHours: i.overtimeHours,
    gross: i.gross,
    deductions: i.deductions,
    tax: i.tax,
    lateDeduction: i.lateDeduction,
    absentDeduction: i.absentDeduction,
    halfDayDeduction: i.halfDayDeduction,
    leaveDeduction: i.leaveDeduction,
    advanceDeduction: i.advanceDeduction,
    net: i.net,
    presentDays: i.presentDays,
    absentDays: i.absentDays,
    halfDays: i.halfDays,
    workingDays: i.workingDays,
    paidLeaveDays: i.paidLeaveDays,
    unpaidLeaveDays: i.unpaidLeaveDays,
    totalHours: i.totalHours,
    weekendPay: i.weekendPay,
    holidayPay: i.holidayPay,
    paymentStatus: i.paymentStatus,
  })) ?? [];

  const totalPayroll = payroll?.netTotal ?? 0;
  const totalGross = payroll?.grossTotal ?? 0;
  const totalDeductions = payroll?.deductionTotal ?? 0;
  const totalTax = payroll?.taxTotal ?? 0;
  const avgSalary = items.length > 0 ? totalPayroll / items.length : 0;
  const totalOvertimePay = items.reduce((sum, i) => sum + i.overtime, 0);

  const periods = payrolls.map((p) => ({
    period: p.period,
    name: p.name,
    status: p.status,
    employeeCount: p._count.items,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Manage employee payroll, view payslips, and run salary calculations."
        breadcrumb="Payroll"
      />
      <PayrollDashboard
        month={month}
        periods={periods}
        items={items}
        totals={{
          totalPayroll,
          totalGross,
          totalDeductions,
          totalTax,
          avgSalary,
          totalOvertimePay,
          employeeCount: items.length,
        }}
        payrollStatus={payroll?.status ?? null}
        payrollId={payroll?.id ?? null}
      />
    </div>
  );
}
