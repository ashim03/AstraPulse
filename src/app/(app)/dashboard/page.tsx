import { format, subDays, subMonths } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, formatDate } from "@/lib/utils";
import { attendanceStatsForDay } from "@/services/attendance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  ListTodo,
  Wallet,
  Receipt,
  TrendingUp,
  FileText,
  PiggyBank,
  Sparkles,
  ArrowRight,
  Activity,
} from "lucide-react";
import { NeedsAttention } from "./needs-attention";
import { RecentActivity } from "./recent-activity";
import { DashboardCharts, type DashboardChartsData } from "./charts";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const wsId = session.workspaceId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [workspace, user, employees, todayAttendance, payrolls, expenses, incomes, invoices, bankAccounts, pendingLeaveCount, pendingTasks, advances] =
    await Promise.all([
      prisma.workspace.findUnique({ where: { id: wsId }, include: { subscription: true } }),
      prisma.user.findUnique({ where: { id: session.id }, include: { role: true } }),
      prisma.employee.findMany({ where: { workspaceId: wsId }, include: { department: true } }),
      attendanceStatsForDay(wsId, now),
      prisma.payroll.findMany({ where: { workspaceId: wsId }, orderBy: { period: "desc" }, take: 6 }),
      prisma.expense.findMany({ where: { workspaceId: wsId }, orderBy: { date: "desc" } }),
      prisma.income.findMany({ where: { workspaceId: wsId }, orderBy: { date: "desc" } }),
      prisma.invoice.findMany({ where: { workspaceId: wsId } }),
      prisma.bankAccount.findMany({ where: { workspaceId: wsId } }),
      prisma.leaveRequest.count({ where: { workspaceId: wsId, status: "pending" } }),
      prisma.task.count({ where: { workspaceId: wsId, status: { in: ["backlog", "todo", "in_progress", "review"] } } }),
      prisma.employeeAdvance.findMany({ where: { workspaceId: wsId, status: { in: ["approved", "paid"] } } }),
    ]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;

  const latestPayroll = payrolls[0];
  const payrollThisMonth = payrolls.find((p) => p.period === format(now, "yyyy-MM"));
  const payrollNet = payrollThisMonth?.netTotal ?? latestPayroll?.netTotal ?? 0;

  const expensesThisMonth = expenses.filter((e) => e.date >= monthStart && e.status !== "rejected").reduce((a, b) => a + b.amount, 0);
  const expensesLastMonth = expenses.filter((e) => e.date >= lastMonthStart && e.date < monthStart && e.status !== "rejected").reduce((a, b) => a + b.amount, 0);

  const revenueThisMonth = incomes.filter((i) => i.date >= monthStart).reduce((a, b) => a + b.amount, 0);
  const revenueLastMonth = incomes.filter((i) => i.date >= lastMonthStart && i.date < monthStart).reduce((a, b) => a + b.amount, 0);

  const outstandingInvoices = invoices.filter((i) => !["paid", "cancelled", "draft"].includes(i.status)).reduce((a, b) => a + (b.total - b.paid), 0);
  const cashBalance = bankAccounts.reduce((a, b) => a + b.currentBalance, 0);
  const outstandingAdvances = advances.reduce((a, b) => a + b.outstanding, 0);

  const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

  // ---- Charts ----
  const attendanceTrendData = [];
  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i);
    const stats = await attendanceStatsForDay(wsId, day);
    attendanceTrendData.push({
      date: format(day, "MMM d"),
      present: stats.present,
      late: stats.late,
      remote: stats.remote,
    });
  }

  const payrollByMonth: Record<string, { label: string; net: number; gross: number }> = {};
  for (const p of payrolls) {
    const [y, m] = p.period.split("-").map(Number);
    const key = `${y}-${m}`;
    payrollByMonth[key] = {
      label: format(new Date(y, m - 1, 1), "MMM"),
      net: (payrollByMonth[key]?.net ?? 0) + p.netTotal,
      gross: (payrollByMonth[key]?.gross ?? 0) + p.grossTotal,
    };
  }
  const payrollTrend = Object.values(payrollByMonth);

  // Revenue vs expenses from journal (accounting-consistent)
  const since = subMonths(now, 5);
  const journalAccounts = await prisma.account.findMany({
    where: { workspaceId: wsId },
    include: { journalLines: { include: { journal: true } } },
  });
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const revenueVsExpense = monthLabels.map((key) => {
    const [y, m] = key.split("-").map(Number);
    let revenue = 0;
    let expense = 0;
    for (const acc of journalAccounts) {
      for (const line of acc.journalLines) {
        if (line.journal.date.getFullYear() === y && line.journal.date.getMonth() === m) {
          if (acc.type === "revenue") revenue += line.credit - line.debit;
          if (acc.type === "expense") expense += line.debit - line.credit;
        }
      }
    }
    return { label: format(new Date(y, m, 1), "MMM"), revenue: Math.round(revenue), expense: Math.round(expense) };
  });

  const expenseByCat: Record<string, number> = {};
  for (const e of expenses) if (e.status !== "rejected") expenseByCat[e.category] = (expenseByCat[e.category] ?? 0) + e.amount;
  const expenseCategories = Object.entries(expenseByCat).map(([name, value]) => ({ name, value: Math.round(value) }));

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { workspaceId: wsId, status: { in: ["approved", "pending"] } },
    include: { type: true },
  });
  const leaveByType: Record<string, number> = {};
  for (const lr of leaveRequests) leaveByType[lr.type.name] = (leaveByType[lr.type.name] ?? 0) + lr.days;
  const leaveDistribution = Object.entries(leaveByType).map(([name, value]) => ({ name, value }));

  const deptCount: Record<string, number> = {};
  for (const e of employees) deptCount[e.department?.name ?? "Unassigned"] = (deptCount[e.department?.name ?? "Unassigned"] ?? 0) + 1;
  const departmentHeadcount = Object.entries(deptCount).map(([name, value]) => ({ name, value }));

  const cashFlow = monthLabels.map((key) => {
    const [y, m] = key.split("-").map(Number);
    let flow = 0;
    for (const acc of journalAccounts) {
      if (["1000", "1010", "1020"].includes(acc.code)) {
        for (const line of acc.journalLines) {
          if (line.journal.date.getFullYear() === y && line.journal.date.getMonth() === m) {
            flow += line.debit - line.credit;
          }
        }
      }
    }
    return { label: format(new Date(y, m, 1), "MMM"), flow: Math.round(flow) };
  });

  const chartsData: DashboardChartsData = {
    attendance: attendanceTrendData,
    payrollTrend,
    revenueVsExpense,
    expenseCategories,
    leaveDistribution,
    departmentHeadcount,
    cashFlow,
  };

  const subscription = workspace?.subscription;
  const firstName = user?.name.split(" ")[0] ?? "there";
  const employeesGrowth = await prisma.employee.count({ where: { workspaceId: wsId, joinDate: { gte: monthStart } } });

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName} 👋`}
        subtitle={`${workspace?.name} · Overview of your business performance`}
        actions={
          <>
            <Link href="/attendance">
              <Button variant="secondary" size="sm" leftIcon={<CalendarCheck className="h-4 w-4" />}>
                Clock in
              </Button>
            </Link>
            <Link href="/payroll">
              <Button size="sm" leftIcon={<Wallet className="h-4 w-4" />}>
                Run payroll
              </Button>
            </Link>
          </>
        }
      />

      {/* Workspace identity / subscription strip */}
      <div className="card mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            {workspace?.name.charAt(0)}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{workspace?.name}</p>
            <p className="text-xs text-slate-500">
              {workspace?.currency} · {workspace?.timezone} · {workspace?.country}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <div>
              <p className="text-xs text-slate-400">Current plan</p>
              <p className="text-sm font-semibold text-slate-800">{subscription?.plan ?? "Trial"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Status</p>
            <StatusBadge status={subscription?.status ?? "trial"} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Renews</p>
            <p className="text-sm font-semibold text-slate-800">{subscription ? formatDate(subscription.renewalDate) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Workspace</p>
            <StatusBadge status={workspace?.status ?? "active"} />
          </div>
        </div>
      </div>

      {/* Attendance pulse + coordination */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Link href="/attendance" className="block lg:col-span-2">
          <Card className="transition hover:shadow-md">
            <CardBody className="p-4 sm:px-5 sm:py-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="section-title flex items-center gap-2">
                    <Activity className="h-4 w-4 text-brand-500" /> Attendance Pulse
                  </h3>
                  <p className="text-xs text-slate-400">Today across {activeEmployees} active employees</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {todayAttendance.present}/{activeEmployees} present
                </span>
              </div>
              <ProgressBar value={activeEmployees === 0 ? 0 : (todayAttendance.present / activeEmployees) * 100} tone="green" />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Late", value: todayAttendance.late, tone: "text-amber-600" },
                  { label: "Remote", value: todayAttendance.remote, tone: "text-sky-600" },
                  { label: "On leave", value: onLeave, tone: "text-violet-600" },
                  { label: "Absent", value: todayAttendance.absent, tone: "text-red-600" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50/60 dark:bg-slate-800/60 px-3 py-2.5">
                    <p className={`text-xl font-semibold ${s.tone}`}>{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-amber-500" /> Pending Coordination
                </h3>
                <p className="text-xs text-slate-400">Needs your attention</p>
              </div>
            </div>
            <div className="space-y-3">
              <Link href="/leave" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50/40 dark:hover:bg-slate-700">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><CalendarDays className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Leave approvals</p>
                    <p className="text-xs text-slate-400">Pending requests</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingLeaveCount}</span>
              </Link>
              <Link href="/tasks" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><ListTodo className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Open tasks</p>
                    <p className="text-xs text-slate-400">In backlog / in progress</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{pendingTasks}</span>
              </Link>
              <Link href="/advances" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-violet-200 hover:bg-violet-50/40 dark:hover:bg-slate-700">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><PiggyBank className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Outstanding advances</p>
                    <p className="text-xs text-slate-400">Awaiting repayment</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700">{money(outstandingAdvances)}</span>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Link href="/staff" className="block transition hover:scale-[1.01]">
          <StatCard title="Total Employees" value={totalEmployees} change={employeesGrowth > 0 ? employeesGrowth * 10 : 0} trend={employeesGrowth > 0 ? "up" : "flat"} icon={Users} tooltip="Total headcount" />
        </Link>
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Present Today" value={`${todayAttendance.present}`} trend="flat" icon={UserCheck} footer={<p className="text-xs text-emerald-600">{Math.round((todayAttendance.present / Math.max(1, activeEmployees)) * 100)}% attendance rate</p>} />
        </Link>
        <Link href="/leave" className="block transition hover:scale-[1.01]">
          <StatCard title="Employees on Leave" value={onLeave} icon={CalendarDays} />
        </Link>
        <Link href="/payroll" className="block transition hover:scale-[1.01]">
          <StatCard title="Payroll This Month" value={money(payrollNet)} change={latestPayroll ? 2.4 : 0} trend="up" icon={Wallet} />
        </Link>
        <Link href="/income" className="block transition hover:scale-[1.01]">
          <StatCard title="Total Revenue" value={money(revenueThisMonth)} change={pct(revenueThisMonth, revenueLastMonth)} trend={revenueThisMonth >= revenueLastMonth ? "up" : "down"} icon={TrendingUp} />
        </Link>
        <Link href="/expenses" className="block transition hover:scale-[1.01]">
          <StatCard title="Total Expenses" value={money(expensesThisMonth)} change={pct(expensesThisMonth, expensesLastMonth)} trend={expensesThisMonth > expensesLastMonth ? "up" : "down"} icon={Receipt} />
        </Link>
        <Link href="/accounting" className="block transition hover:scale-[1.01]">
          <StatCard title="Cash Balance" value={money(cashBalance)} icon={PiggyBank} footer={<p className="text-xs text-slate-400">{bankAccounts.length} accounts</p>} />
        </Link>
        <Link href="/invoices" className="block transition hover:scale-[1.01]">
          <StatCard title="Outstanding Invoices" value={money(outstandingInvoices)} icon={FileText} />
        </Link>
      </div>

      {/* Charts */}
      <div className="mb-4">
        <DashboardCharts data={chartsData} />
      </div>

      {/* Needs attention + recent activity */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <NeedsAttention workspaceId={wsId} />
        <div className="space-y-4">
          <RecentActivity workspaceId={wsId} />
        </div>
      </div>
    </>
  );
}