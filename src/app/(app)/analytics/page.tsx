import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { AnalyticsClient } from "./analytics-client";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await requireSession();

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [employees, attendance, leave, payroll, invoices, expenses, income] = await Promise.all([
    prisma.employee.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, departmentId: true, joinDate: true } }),
    prisma.attendance.findMany({
      where: { workspaceId: session.workspaceId, date: { gte: sixMonthsAgo } },
      select: { id: true, date: true, hours: true, status: true },
    }),
    prisma.leaveRequest.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, startDate: true, status: true } }),
    prisma.payroll.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, period: true, netTotal: true } }),
    prisma.invoice.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, date: true, total: true } }),
    prisma.expense.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, date: true, amount: true, category: true } }),
    prisma.income.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, date: true, amount: true, category: true } }),
  ]);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const revenueByMonth = months.map((m) => ({ month: m, value: 0 }));
  const expenseByMonth = months.map((m) => ({ month: m, value: 0 }));
  const attendanceByMonth = months.map((m) => ({ month: m, hours: 0 }));
  const invoiceByMonth = months.map((m) => ({ month: m, value: 0 }));

  for (const i of income) revenueByMonth.find((x) => x.month === monthKey(i.date))!.value += i.amount;
  for (const e of expenses) expenseByMonth.find((x) => x.month === monthKey(e.date))!.value += e.amount;
  for (const a of attendance) attendanceByMonth.find((x) => x.month === monthKey(a.date))!.hours += a.hours;
  for (const inv of invoices) invoiceByMonth.find((x) => x.month === monthKey(inv.date))!.value += inv.total;

  const deptCount = new Map<string, number>();
  for (const e of employees) {
    if (e.departmentId) deptCount.set(e.departmentId, (deptCount.get(e.departmentId) ?? 0) + 1);
  }
  const departments = await prisma.department.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true, name: true } });
  const headcount = departments.map((d) => ({ name: d.name, value: deptCount.get(d.id) ?? 0 }));

  const expByCat = new Map<string, number>();
  for (const e of expenses) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + e.amount);
  const categoryBreakdown = Array.from(expByCat.entries()).map(([name, value]) => ({ name, value }));

  const revTotal = revenueByMonth.reduce((s, x) => s + x.value, 0);
  const expTotal = expenseByMonth.reduce((s, x) => s + x.value, 0);
  const payrollTotal = payroll.reduce((s, p) => s + p.netTotal, 0);
  const attendanceHours = attendance.reduce((s, a) => s + a.hours, 0);
  const avgAttendance = attendance.length ? Math.round((attendanceHours / attendance.length) * 10) / 10 : 0;

  const stats = [
    { label: "Headcount", value: employees.length, prefix: "" },
    { label: "6-mo revenue", value: revTotal, prefix: "$" },
    { label: "6-mo expenses", value: expTotal, prefix: "$" },
    { label: "6-mo payroll", value: payrollTotal, prefix: "$" },
    { label: "Hours logged", value: attendanceHours, prefix: "" },
    { label: "Avg daily hours", value: avgAttendance, prefix: "" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="People and finance insights across the last six months." breadcrumb="Reports" />
      <AnalyticsClient
        stats={stats}
        revenueByMonth={revenueByMonth}
        expenseByMonth={expenseByMonth}
        invoiceByMonth={invoiceByMonth}
        attendanceByMonth={attendanceByMonth}
        headcount={headcount}
        categoryBreakdown={categoryBreakdown}
      />
    </div>
  );
}