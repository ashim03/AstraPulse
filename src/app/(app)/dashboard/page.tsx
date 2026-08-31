import { format, subDays, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, formatDate, formatTimeNepal } from "@/lib/utils";
import { attendanceStatsForDay, attendanceTrend } from "@/services/attendance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  HardDrive,
  Wifi,
  WifiOff,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { NeedsAttention } from "./needs-attention";
import { RecentActivity } from "./recent-activity";
import { DashboardCharts, type DashboardChartsData } from "./charts";
import Link from "next/link";
import { getSafeEmployeeSelect, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const wsId = session.workspaceId;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const isEmployee = session.role === "Employee";
  const isManager = session.role === "Manager";
  const isAdmin =
    session.role === "Workspace Admin" ||
    session.role === "HR Manager" ||
    session.role === "HR Staff";

  const firstName = String(session.name ?? "").split(" ")[0] ?? "there";

  const user = await prisma.user.findUnique({ where: { id: session.id }, include: { role: true } });
  const workspace = await prisma.workspace.findUnique({ where: { id: wsId }, include: { subscription: true } });

  // ── Employee Dashboard ──────────────────────────────────────────────
  if (isEmployee) {
    const [myAttendance, myPendingLeaves, myTasks, myRecentAttendance, myLeaveBalance, monthAttendance, latestPayrollItem] =
      await Promise.all([
        session.employeeId
          ? prisma.attendance.findFirst({
              where: { employeeId: session.employeeId, date: { gte: todayStart, lte: todayEnd } },
            })
          : null,
        session.employeeId
          ? prisma.leaveRequest.count({ where: { employeeId: session.employeeId, status: "pending" } })
          : 0,
        session.employeeId
          ? prisma.task.findMany({
              where: { OR: [{ assigneeId: session.employeeId }, { createdBy: session.id }] },
              orderBy: { createdAt: "desc" },
              take: 10,
            })
          : [],
        session.employeeId
          ? prisma.attendance.findMany({
              where: { employeeId: session.employeeId },
              orderBy: { date: "desc" },
              take: 7,
            })
          : [],
        session.employeeId
          ? prisma.leaveRequest.findMany({
              where: { employeeId: session.employeeId, status: { in: ["approved", "pending"] } },
              include: { type: true },
            })
          : [],
        session.employeeId
          ? prisma.attendance.findMany({
              where: { employeeId: session.employeeId, date: { gte: startOfMonth(now), lte: now } },
            })
          : [],
        session.employeeId
          ? prisma.payrollItem.findFirst({
              where: { employeeId: session.employeeId },
              include: { payroll: true },
              orderBy: { payroll: { period: "desc" } },
            })
          : null,
      ]);

    const tasksTodo = myTasks.filter((t) => t.status === "todo").length;
    const tasksInProgress = myTasks.filter((t) => t.status === "in_progress").length;
    const tasksCompleted = myTasks.filter((t) => t.status === "completed").length;
    const tasksOpen = tasksTodo + tasksInProgress;

    const totalLeaveDays = myLeaveBalance.filter((r) => r.status === "approved").reduce((a, b) => a + b.days, 0);

    const monthPresent = monthAttendance.filter((a) => a.status === "present" || a.status === "late" || a.status === "remote").length;
    const monthAbsent = monthAttendance.filter((a) => a.status === "absent").length;
    const monthLate = monthAttendance.filter((a) => a.status === "late").length;
    const monthHalfDays = monthAttendance.filter((a) => a.isHalfDay).length;
    const monthTotalHours = monthAttendance.reduce((sum, a) => sum + (a.hours || 0), 0);
    const monthOvertime = monthAttendance.reduce((sum, a) => sum + (a.overtime || 0), 0);

    const clockInTime = myAttendance?.clockIn ? format(myAttendance.clockIn, "h:mm a") : "—";
    const clockOutTime = myAttendance?.clockOut ? format(myAttendance.clockOut, "h:mm a") : "—";
    const workingHours = myAttendance?.hours ? `${myAttendance.hours.toFixed(1)}h` : "—";
    const attendanceStatus = myAttendance?.status ?? "absent";
    const statusLabel = attendanceStatus === "late" ? "Late" : attendanceStatus === "present" ? "Present" : attendanceStatus === "remote" ? "Remote" : attendanceStatus === "early" ? "Left Early" : "Absent";
    const statusTone =
      attendanceStatus === "present"
        ? "bg-emerald-50 text-emerald-700"
        : attendanceStatus === "late"
        ? "bg-amber-50 text-amber-700"
        : attendanceStatus === "remote"
        ? "bg-sky-50 text-sky-700"
        : "bg-red-50 text-red-700";

    return (
      <>
        <PageHeader
          title={`Hello, ${firstName} 👋`}
          subtitle="Your personal dashboard"
          actions={
            <Link href="/attendance">
              <Button variant="primary" size="sm" leftIcon={<Clock className="h-4 w-4" />}>
                Clock in/out
              </Button>
            </Link>
          }
        />

        {/* Status + Quick Stats */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="transition hover:shadow-md">
            <CardBody className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="section-title flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-500" /> Today&apos;s Status
                </p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <p className="text-xs text-slate-400">Clock In</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{clockInTime}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <p className="text-xs text-slate-400">Clock Out</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{clockOutTime}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <p className="text-xs text-slate-400">Hours</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{workingHours}</p>
                </div>
              </div>
              {myAttendance && myAttendance.overtime > 0 && (
                <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
                  <p className="text-xs text-emerald-600">Overtime today</p>
                  <p className="text-sm font-semibold text-emerald-700">{myAttendance.overtime.toFixed(1)}h</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="transition hover:shadow-md">
            <CardBody className="p-4">
              <p className="section-title flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" /> My Leave
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Days taken this month</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{totalLeaveDays}d</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Pending requests</span>
                  <span className="text-sm font-semibold text-amber-600">{myPendingLeaves}</span>
                </div>
              </div>
              <Link href="/leave" className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View leave history <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>

          <Card className="transition hover:shadow-md">
            <CardBody className="p-4">
              <p className="section-title flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-sky-500" /> My Tasks
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Open</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tasksOpen}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">In Progress</span>
                  <span className="text-sm font-semibold text-sky-600">{tasksInProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Completed</span>
                  <span className="text-sm font-semibold text-emerald-600">{tasksCompleted}</span>
                </div>
              </div>
              <Link href="/tasks" className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>

          <div className="flex flex-col gap-3">
            <Link href="/leave" className="block">
              <Card className="transition hover:shadow-md">
                <CardBody className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <CalendarCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Apply for Leave</p>
                    <p className="text-xs text-slate-400">Submit a new request</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
            <Link href="/work-records" className="block">
              <Card className="transition hover:shadow-md">
                <CardBody className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Submit Work Record</p>
                    <p className="text-xs text-slate-400">Log your work hours</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          </div>
        </div>

        {/* Monthly Attendance Summary */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardBody className="p-4">
              <p className="section-title flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-brand-500" /> Monthly Attendance
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-emerald-700">{monthPresent}</p>
                  <p className="text-xs text-emerald-600">Present</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-amber-700">{monthLate}</p>
                  <p className="text-xs text-amber-600">Late</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2.5 text-center">
                  <p className="text-xl font-bold text-red-700">{monthAbsent}</p>
                  <p className="text-xs text-red-600">Absent</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthTotalHours.toFixed(0)}h</p>
                  <p className="text-xs text-slate-400">Total Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthOvertime.toFixed(1)}h</p>
                  <p className="text-xs text-slate-400">Overtime</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{monthHalfDays}</p>
                  <p className="text-xs text-slate-400">Half Days</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {latestPayrollItem && (
            <Card>
              <CardBody className="p-4">
                <p className="section-title flex items-center gap-2 mb-3">
                  <Wallet className="h-4 w-4 text-violet-500" /> Latest Payroll
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Period</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(new Date(latestPayrollItem.payroll.period + "-01"), "MMM yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Net Pay</span>
                    <span className="text-sm font-bold text-emerald-600">{money(latestPayrollItem.net)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Gross</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{money(latestPayrollItem.gross)}</span>
                  </div>
                </div>
                <Link href={`/payroll/${latestPayrollItem.payrollId}`} className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                  View details <ArrowRight className="h-3 w-3" />
                </Link>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody className="p-4">
              <p className="section-title flex items-center gap-2 mb-3">
                <UserCheck className="h-4 w-4 text-emerald-500" /> Quick Links
              </p>
              <div className="space-y-2">
                <Link href="/attendance" className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Clock className="h-4 w-4 text-slate-400" /> View My Attendance
                </Link>
                <Link href="/leave" className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <CalendarDays className="h-4 w-4 text-slate-400" /> View My Leave
                </Link>
                <Link href="/settings/change-password" className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <AlertCircle className="h-4 w-4 text-slate-400" /> Change Password
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* My Recent Activity */}
        <Card>
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <h3 className="section-title flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-brand-500" /> My Recent Activity
            </h3>
            {myRecentAttendance.length === 0 ? (
              <p className="text-sm text-slate-400">No recent activity yet.</p>
            ) : (
              <div className="space-y-2">
                {myRecentAttendance.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${att.status === "present" || att.status === "late" || att.status === "remote" ? "bg-emerald-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(att.date, "EEE, MMM d")}
                        </p>
                        <p className="text-xs text-slate-400">
                          {att.clockIn ? `Clocked in at ${format(att.clockIn, "h:mm a")}` : "No clock-in"}
                          {att.clockOut ? ` · ${format(att.clockOut, "h:mm a")}` : ""}
                          {att.hours > 0 ? ` · ${att.hours.toFixed(1)}h` : ""}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={att.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  // ── Manager Dashboard ───────────────────────────────────────────────
  if (isManager) {
    const deptEmployees = session.departmentId
      ? await prisma.employee.findMany({
          where: { departmentId: session.departmentId },
          select: { id: true, name: true, status: true },
        })
      : [];
    const deptEmployeeIds = deptEmployees.map((e) => e.id);

    const [deptAttendance, pendingLeaveForDept, pendingWorkRecords, teamTasks] =
      await Promise.all([
        deptEmployeeIds.length > 0
          ? prisma.attendance.findMany({
              where: { employeeId: { in: deptEmployeeIds }, date: { gte: todayStart, lte: todayEnd } },
            })
          : [],
        deptEmployeeIds.length > 0
          ? prisma.leaveRequest.count({ where: { employeeId: { in: deptEmployeeIds }, status: "pending" } })
          : 0,
        deptEmployeeIds.length > 0
          ? prisma.workRecord.count({ where: { employeeId: { in: deptEmployeeIds }, status: "pending" } })
          : 0,
        deptEmployeeIds.length > 0
          ? prisma.task.findMany({
              where: { assigneeId: { in: deptEmployeeIds } },
              orderBy: { createdAt: "desc" },
              take: 8,
            })
          : [],
      ]);

    const totalInDept = deptEmployees.length;
    const activeInDept = deptEmployees.filter((e) => e.status === "active").length;
    const onLeaveInDept = deptEmployees.filter((e) => e.status === "on_leave").length;
    const presentToday = deptAttendance.filter((a) => a.status === "present" || a.status === "late" || a.status === "remote").length;
    const lateToday = deptAttendance.filter((a) => a.status === "late").length;

    const tasksTodo = teamTasks.filter((t) => t.status === "todo").length;
    const tasksInProgress = teamTasks.filter((t) => t.status === "in_progress").length;
    const tasksOpen = tasksTodo + tasksInProgress;

    return (
      <>
        <PageHeader
          title={`Hello, ${firstName} 👋`}
          subtitle="Your team overview"
          actions={
            <Link href="/attendance">
              <Button variant="secondary" size="sm" leftIcon={<CalendarCheck className="h-4 w-4" />}>
                My attendance
              </Button>
            </Link>
          }
        />

        {/* Team Stats */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/attendance" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Team Present Today"
              value={presentToday}
              trend="flat"
              icon={UserCheck}
              footer={<p className="text-xs text-slate-400">{lateToday} late</p>}
            />
          </Link>
          <Link href="/staff" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Team Size"
              value={activeInDept}
              trend="flat"
              icon={Users}
              footer={<p className="text-xs text-slate-400">{onLeaveInDept} on leave</p>}
            />
          </Link>
          <Link href="/leave" className="block transition hover:scale-[1.01]">
            <StatCard title="Pending Leave Requests" value={pendingLeaveForDept} icon={CalendarDays} />
          </Link>
          <Link href="/tasks" className="block transition hover:scale-[1.01]">
            <StatCard title="Open Team Tasks" value={tasksOpen} icon={ListTodo} />
          </Link>
        </div>

        {/* Team Attendance + Pending Approvals */}
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Link href="/attendance" className="block lg:col-span-2">
            <Card className="transition hover:shadow-md">
              <CardBody className="p-4 sm:px-5 sm:py-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="section-title flex items-center gap-2">
                      <Activity className="h-4 w-4 text-brand-500" /> Team Attendance
                    </h3>
                    <p className="text-xs text-slate-400">Today across {activeInDept} active members</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {presentToday}/{activeInDept} present
                  </span>
                </div>
                <ProgressBar value={activeInDept === 0 ? 0 : (presentToday / activeInDept) * 100} tone="green" />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Late", value: lateToday, tone: "text-amber-600" },
                    { label: "On Leave", value: onLeaveInDept, tone: "text-violet-600" },
                    { label: "Active", value: activeInDept, tone: "text-emerald-600" },
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
              <div className="mb-3">
                <h3 className="section-title flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-amber-500" /> Pending Approvals
                </h3>
                <p className="text-xs text-slate-400">Needs your review</p>
              </div>
              <div className="space-y-3">
                <Link href="/leave" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50/40 dark:hover:bg-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><CalendarDays className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Leave requests</p>
                      <p className="text-xs text-slate-400">From your team</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pendingLeaveForDept}</span>
                </Link>
                <Link href="/tasks" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><ClipboardList className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Work records</p>
                      <p className="text-xs text-slate-400">Pending approval</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{pendingWorkRecords}</span>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Team Tasks */}
        <Card className="mb-4">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-sky-500" /> My Team&apos;s Tasks
              </h3>
              <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {teamTasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks assigned to your team.</p>
            ) : (
              <div className="space-y-2">
                {teamTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{task.title}</p>
                      <p className="text-xs text-slate-400">
                        {task.priority} priority {task.dueDate ? `· Due ${formatDate(task.dueDate)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-4">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <h3 className="section-title mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Link href="/staff" className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">View Team</p>
                  <p className="text-xs text-slate-400">Members & profiles</p>
                </div>
              </Link>
              <Link href="/leave" className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Approve Leave</p>
                  <p className="text-xs text-slate-400">{pendingLeaveForDept} pending</p>
                </div>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Needs attention + recent activity */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <NeedsAttention workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
          <div className="space-y-4">
            <RecentActivity workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
          </div>
        </div>
      </>
    );
  }

  // ── HR Dashboard ─────────────────────────────────────────────────
  const isHR = session.role === "HR Manager" || session.role === "HR Staff";

  if (isHR && !isManager) {
    const [hrEmployees, hrTodayAttendance, hrPendingLeave, hrRecentLeave, hrNewThisMonth] =
      await Promise.all([
        prisma.employee.findMany({
          where: { workspaceId: wsId },
          select: { id: true, name: true, status: true, department: { select: { name: true } } },
        }),
        attendanceStatsForDay(wsId, now),
        prisma.leaveRequest.count({ where: { workspaceId: wsId, status: "pending" } }),
        prisma.leaveRequest.findMany({
          where: { workspaceId: wsId, status: "pending" },
          include: { employee: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.employee.count({
          where: { workspaceId: wsId, joinDate: { gte: startOfMonth(now) } },
        }),
      ]);

    const hrActive = hrEmployees.filter((e) => e.status === "active").length;
    const hrOnLeave = hrEmployees.filter((e) => e.status === "on_leave").length;

    return (
      <>
        <PageHeader
          title={`Hello, ${firstName} 👋`}
          subtitle="Workforce management overview"
          actions={
            <Link href="/staff">
              <Button size="sm" leftIcon={<Users className="h-4 w-4" />}>
                View Staff
              </Button>
            </Link>
          }
        />

        {/* Workforce Overview */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/staff" className="block transition hover:scale-[1.01]">
            <StatCard title="Total Employees" value={hrEmployees.length} icon={Users} footer={<p className="text-xs text-slate-400">{hrActive} active</p>} />
          </Link>
          <Link href="/attendance" className="block transition hover:scale-[1.01]">
            <StatCard title="Present Today" value={hrTodayAttendance.present} trend="flat" icon={UserCheck} footer={<p className="text-xs text-emerald-600">{hrTodayAttendance.late} late</p>} />
          </Link>
          <Link href="/leave" className="block transition hover:scale-[1.01]">
            <StatCard title="On Leave" value={hrOnLeave} icon={CalendarDays} footer={hrPendingLeave > 0 ? <p className="text-xs text-amber-600">{hrPendingLeave} pending</p> : undefined} />
          </Link>
          <StatCard title="New This Month" value={hrNewThisMonth} icon={TrendingUp} />
        </div>

        {/* Attendance Pulse */}
        <Card className="mb-4">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-500" /> Attendance Pulse
                </h3>
                <p className="text-xs text-slate-400">Today across {hrActive} active employees</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {hrTodayAttendance.present}/{hrActive} present
              </span>
            </div>
            <ProgressBar value={hrActive === 0 ? 0 : (hrTodayAttendance.present / hrActive) * 100} tone="green" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Late", value: hrTodayAttendance.late, tone: "text-amber-600" },
                { label: "Remote", value: hrTodayAttendance.remote, tone: "text-sky-600" },
                { label: "On leave", value: hrOnLeave, tone: "text-violet-600" },
                { label: "Absent", value: hrTodayAttendance.absent, tone: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50/60 dark:bg-slate-800/60 px-3 py-2.5">
                  <p className={`text-xl font-semibold ${s.tone}`}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Recent Leave Requests */}
        <Card className="mb-4">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" /> Recent Leave Requests
              </h3>
              <Link href="/leave" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {hrRecentLeave.length === 0 ? (
              <p className="text-sm text-slate-400">No pending leave requests.</p>
            ) : (
              <div className="space-y-2">
                {hrRecentLeave.map((lr) => (
                  <div key={lr.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={lr.employee.name} size="xs" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{lr.employee.name}</p>
                        <p className="text-xs text-slate-400">{lr.type.name} · {lr.days}d · {formatDate(lr.startDate)}</p>
                      </div>
                    </div>
                    <Badge tone="amber">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* HR Quick Actions */}
        <Card className="mb-4">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <h3 className="section-title mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Link href="/staff" className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Staff Directory</p>
                  <p className="text-xs text-slate-400">{hrEmployees.length} employees</p>
                </div>
              </Link>
              <Link href="/attendance/reports" className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Activity className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Attendance Reports</p>
                  <p className="text-xs text-slate-400">View reports</p>
                </div>
              </Link>
              <Link href="/leave" className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><CalendarDays className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Manage Leave</p>
                  <p className="text-xs text-slate-400">{hrPendingLeave} pending</p>
                </div>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Needs attention + recent activity */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <NeedsAttention workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
          <div className="space-y-4">
            <RecentActivity workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
          </div>
        </div>
      </>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────────────────
  const canViewFinance = hasPermission(session, "payroll", "view") || hasPermission(session, "expenses", "view") || hasPermission(session, "income", "view") || hasPermission(session, "accounting", "view");
  const canViewPayroll = hasPermission(session, "payroll", "view");
  const canCreatePayroll = hasPermission(session, "payroll", "create");
  const canViewExpenses = hasPermission(session, "expenses", "view");
  const canViewIncome = hasPermission(session, "income", "view");
  const canViewAccounting = hasPermission(session, "accounting", "view");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [employees, todayAttendance, pendingLeaveCount, pendingTasks, advances, devices] =
    await Promise.all([
      prisma.employee.findMany({
        where: { workspaceId: wsId },
        select: {
          ...getSafeEmployeeSelect(session),
          department: { select: { id: true, name: true } },
        },
      }),
      attendanceStatsForDay(wsId, now),
      prisma.leaveRequest.count({ where: { workspaceId: wsId, status: "pending" } }),
      prisma.task.count({ where: { workspaceId: wsId, status: { in: ["backlog", "todo", "in_progress", "review"] } } }),
      prisma.employeeAdvance.findMany({ where: { workspaceId: wsId, status: { in: ["approved", "paid"] } } }),
      prisma.attendanceDevice.findMany({ where: { workspaceId: wsId } }),
    ]);

  // Additional admin-specific queries
  const [
    pendingCorrections,
    unreadMessages,
    todayLeaveOnApproved,
    todayLateAttendees,
    todayOvertimeAttendees,
    recentAuditLogs,
    todayAttendanceRecords,
  ] = await Promise.all([
    prisma.attendanceAdjustment.count({ where: { workspaceId: wsId, status: "pending" } }),
    prisma.messageRecipient.count({
      where: {
        recipientId: session.id,
        readAt: null,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        workspaceId: wsId,
        status: "approved",
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
    }),
    prisma.attendance.findMany({
      where: {
        workspaceId: wsId,
        date: { gte: todayStart, lte: todayEnd },
        lateMinutes: { gt: 0 },
      },
      include: { employee: { select: { id: true, name: true, employeeId: true, department: { select: { name: true } } } } },
      orderBy: { lateMinutes: "desc" },
    }),
    prisma.attendance.findMany({
      where: {
        workspaceId: wsId,
        date: { gte: todayStart, lte: todayEnd },
        overtime: { gt: 0 },
      },
      include: { employee: { select: { id: true, name: true, employeeId: true, department: { select: { name: true } } } } },
      orderBy: { overtime: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: wsId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.attendance.findMany({
      where: {
        workspaceId: wsId,
        date: { gte: todayStart, lte: todayEnd },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { clockIn: "asc" },
    }),
  ]);

  let safePayrolls: any[] = [];
  let safeExpenses: any[] = [];
  let safeIncomes: any[] = [];
  let safeInvoices: any[] = [];
  let safeBankAccounts: any[] = [];

  if (canViewFinance) {
    const [payrolls, expenses, incomes, invoices, bankAccounts] = await Promise.all([
      prisma.payroll.findMany({ where: { workspaceId: wsId }, orderBy: { period: "desc" }, take: 6 }),
      prisma.expense.findMany({ where: { workspaceId: wsId }, orderBy: { date: "desc" } }),
      prisma.income.findMany({ where: { workspaceId: wsId }, orderBy: { date: "desc" } }),
      prisma.invoice.findMany({ where: { workspaceId: wsId } }),
      prisma.bankAccount.findMany({ where: { workspaceId: wsId } }),
    ]);
    safePayrolls = payrolls;
    safeExpenses = expenses;
    safeIncomes = incomes;
    safeInvoices = invoices;
    safeBankAccounts = bankAccounts;
  }

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e: any) => e.status === "active").length;
  const onLeave = employees.filter((e: any) => e.status === "on_leave").length;

  const latestPayroll = safePayrolls[0];
  const payrollThisMonth = safePayrolls.find((p) => p.period === format(now, "yyyy-MM"));
  const payrollNet = payrollThisMonth?.netTotal ?? latestPayroll?.netTotal ?? 0;

  const expensesThisMonth = safeExpenses.filter((e) => e.date >= monthStart && e.status !== "rejected").reduce((a, b) => a + b.amount, 0);
  const expensesLastMonth = safeExpenses.filter((e) => e.date >= lastMonthStart && e.date < monthStart && e.status !== "rejected").reduce((a, b) => a + b.amount, 0);

  const revenueThisMonth = safeIncomes.filter((i) => i.date >= monthStart).reduce((a, b) => a + b.amount, 0);
  const revenueLastMonth = safeIncomes.filter((i) => i.date >= lastMonthStart && i.date < monthStart).reduce((a, b) => a + b.amount, 0);

  const outstandingInvoices = safeInvoices.filter((i) => !["paid", "cancelled", "draft"].includes(i.status)).reduce((a, b) => a + (b.total - b.paid), 0);
  const cashBalance = safeBankAccounts.reduce((a, b) => a + b.currentBalance, 0);
  const outstandingAdvances = advances.reduce((a, b) => a + b.outstanding, 0);

  const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

  const attendanceTrendRaw = await attendanceTrend(wsId, 30);
  const attendanceTrendData = [];
  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i);
    const dayKey = day.toISOString().slice(0, 10);
    const stats = attendanceTrendRaw.find((d) => d.date === dayKey);
    attendanceTrendData.push({
      date: format(day, "MMM d"),
      present: stats?.present ?? 0,
      late: stats?.late ?? 0,
      remote: stats?.remote ?? 0,
    });
  }

  let payrollTrend: { label: string; net: number; gross: number }[] = [];
  let revenueVsExpense: { label: string; revenue: number; expense: number }[] = [];
  let expenseCategories: { name: string; value: number }[] = [];
  let cashFlow: { label: string; flow: number }[] = [];
  let monthLabels: string[] = [];

  if (canViewFinance) {
    const payrollByMonth: Record<string, { label: string; net: number; gross: number }> = {};
    for (const p of safePayrolls) {
      const [y, m] = String(p.period ?? "").split("-").map(Number);
      const key = `${y}-${m}`;
      payrollByMonth[key] = {
        label: format(new Date(y, m - 1, 1), "MMM"),
        net: (payrollByMonth[key]?.net ?? 0) + p.netTotal,
        gross: (payrollByMonth[key]?.gross ?? 0) + p.grossTotal,
      };
    }
    payrollTrend = Object.values(payrollByMonth);

    const journalAccounts = await prisma.account.findMany({
      where: { workspaceId: wsId },
      include: { journalLines: { include: { journal: true } } },
    });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    revenueVsExpense = monthLabels.map((key) => {
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
    for (const e of safeExpenses) if (e.status !== "rejected") expenseByCat[e.category] = (expenseByCat[e.category] ?? 0) + e.amount;
    expenseCategories = Object.entries(expenseByCat).map(([name, value]) => ({ name, value: Math.round(value) }));

    cashFlow = monthLabels.map((key) => {
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
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { workspaceId: wsId, status: { in: ["approved", "pending"] } },
    include: { type: true },
  });
  const leaveByType: Record<string, number> = {};
  for (const lr of leaveRequests) leaveByType[lr.type.name] = (leaveByType[lr.type.name] ?? 0) + lr.days;
  const leaveDistribution = Object.entries(leaveByType).map(([name, value]) => ({ name, value }));

  const deptCount: Record<string, number> = {};
  for (const e of employees as any[]) deptCount[e.department?.name ?? "Unassigned"] = (deptCount[e.department?.name ?? "Unassigned"] ?? 0) + 1;
  const departmentHeadcount = Object.entries(deptCount).map(([name, value]) => ({ name, value }));

  const chartsData: DashboardChartsData = {
    attendance: attendanceTrendData,
    payrollTrend: canViewFinance ? payrollTrend : [],
    revenueVsExpense: canViewFinance ? revenueVsExpense : [],
    expenseCategories: canViewFinance ? expenseCategories : [],
    leaveDistribution,
    departmentHeadcount,
    cashFlow: canViewFinance ? cashFlow : [],
  };

  const subscription = workspace?.subscription;
  const employeesGrowth = await prisma.employee.count({ where: { workspaceId: wsId, joinDate: { gte: monthStart } } });

  // Device sync status
  const primaryDevice = devices.length > 0 ? devices[0] : null;
  const deviceOnline = primaryDevice?.status === "online";
  const lastSyncAt = primaryDevice?.lastSyncAt ?? null;
  const deviceSyncedEmployees = employees.filter((e: any) => e.deviceEmployeeId).length;
  const failedSyncCount = employees.filter((e: any) => e.status === "active" && !e.deviceEmployeeId).length;

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
            {canCreatePayroll && (
              <Link href="/payroll">
                <Button size="sm" leftIcon={<Wallet className="h-4 w-4" />}>
                  Run payroll
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Workspace identity / subscription strip */}
      <div className="card mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            {workspace?.name?.charAt(0) ?? "?"}
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
              <p className="text-sm font-semibold text-slate-800">{subscription?.planName ?? "Trial"}</p>
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

      {/* ── Summary Cards Row ── */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <Link href="/staff" className="block transition hover:scale-[1.01]">
          <StatCard title="Total Staff" value={totalEmployees} change={employeesGrowth > 0 ? employeesGrowth * 10 : 0} trend={employeesGrowth > 0 ? "up" : "flat"} icon={Users} tooltip="Active employees" footer={<p className="text-xs text-slate-400">{activeEmployees} active</p>} />
        </Link>
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Present Today" value={`${todayAttendance.present}`} trend="flat" icon={UserCheck} footer={<p className="text-xs text-emerald-600">{Math.round((todayAttendance.present / Math.max(1, activeEmployees)) * 100)}% rate</p>} />
        </Link>
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Absent Today" value={todayAttendance.absent} icon={AlertTriangle} footer={<p className="text-xs text-red-600">of {activeEmployees} active</p>} />
        </Link>
        <Link href="/leave" className="block transition hover:scale-[1.01]">
          <StatCard title="On Leave" value={todayLeaveOnApproved} icon={CalendarDays} footer={pendingLeaveCount > 0 ? <p className="text-xs text-amber-600">{pendingLeaveCount} pending</p> : undefined} />
        </Link>
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Late Today" value={todayLateAttendees.length} icon={Clock} footer={todayLateAttendees.length > 0 ? <p className="text-xs text-amber-600">{todayLateAttendees.length > 0 ? `${todayLateAttendees[0]?.lateMinutes}m max` : ""}</p> : undefined} />
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Overtime Today" value={todayOvertimeAttendees.length} icon={Activity} footer={todayOvertimeAttendees.length > 0 ? <p className="text-xs text-emerald-600">{todayOvertimeAttendees.reduce((s, a) => s + a.overtime, 0).toFixed(1)}h total</p> : undefined} />
        </Link>
        <Link href="/leave" className="block transition hover:scale-[1.01]">
          <StatCard title="Pending Leaves" value={pendingLeaveCount} icon={CalendarDays} />
        </Link>
        <Link href="/attendance" className="block transition hover:scale-[1.01]">
          <StatCard title="Pending Corrections" value={pendingCorrections} icon={ClipboardList} />
        </Link>
        <Link href="/mail" className="block transition hover:scale-[1.01]">
          <StatCard title="Unread Messages" value={unreadMessages} icon={MessageSquare} />
        </Link>
        <Link href="/staff/device-sync" className="block transition hover:scale-[1.01]">
          <StatCard
            title="Device Sync"
            value={deviceOnline ? "Online" : "Offline"}
            icon={deviceOnline ? Wifi : WifiOff}
            iconClass={deviceOnline ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}
            footer={<p className="text-xs text-slate-400">{deviceSyncedEmployees} synced · {failedSyncCount} pending</p>}
          />
        </Link>
      </div>

      {/* ── Today's Attendance Table + Device Status ── */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-500" /> Today&apos;s Attendance
              </h3>
              <Link href="/attendance" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {todayAttendanceRecords.length === 0 ? (
              <p className="text-sm text-slate-400">No attendance records for today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left font-medium text-slate-500">Employee</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Department</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Clock In</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Clock Out</th>
                      <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                      <th className="pb-2 text-right font-medium text-slate-500">Hours</th>
                      <th className="pb-2 text-right font-medium text-slate-500">Late</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {todayAttendanceRecords.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Avatar name={att.employee.name} size="xs" />
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300">{att.employee.name}</p>
                              <p className="text-xs text-slate-400">{att.employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-500">{att.employee.department?.name ?? "—"}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{formatTimeNepal(att.clockIn)}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{formatTimeNepal(att.clockOut)}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={att.status} /></td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-600">{att.hours > 0 ? `${att.hours.toFixed(1)}h` : "—"}</td>
                        <td className="py-2.5 text-right font-mono text-xs">
                          {att.lateMinutes > 0 ? (
                            <span className="text-amber-600">{att.lateMinutes}m</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Device Status Card */}
        <Card>
          <CardBody className="p-4 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-sky-500" /> Device Status
              </h3>
              {primaryDevice && (
                <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${deviceOnline ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${deviceOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                  {deviceOnline ? "Online" : "Offline"}
                </span>
              )}
            </div>
            {!primaryDevice ? (
              <div className="text-center py-6">
                <HardDrive className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No device configured</p>
                <Link href="/attendance/settings" className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                  Set up device
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Device</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{primaryDevice.name}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400">IP Address</span>
                    <span className="text-xs font-mono text-slate-600">{primaryDevice.ipAddress}</span>
                  </div>
                  {primaryDevice.model && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Model</span>
                      <span className="text-xs text-slate-600">{primaryDevice.model}</span>
                    </div>
                  )}
                  {primaryDevice.serialNumber && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Serial</span>
                      <span className="text-xs font-mono text-slate-600">{primaryDevice.serialNumber}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Last Sync</span>
                    <span className="text-xs font-medium text-slate-600">
                      {lastSyncAt ? formatDate(lastSyncAt, "MMM d, HH:mm") : "Never"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Employees Synced</span>
                    <span className="text-xs font-semibold text-emerald-600">{deviceSyncedEmployees}/{totalEmployees}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Failed Syncs</span>
                    <span className={`text-xs font-semibold ${failedSyncCount > 0 ? "text-red-600" : "text-slate-600"}`}>
                      {failedSyncCount}
                    </span>
                  </div>
                </div>

                <Link href="/staff/device-sync" className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/30 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <RefreshCw className="h-4 w-4" /> Manage Device Sync
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Attendance pulse + coordination ── */}
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
              {hasPermission(session, "attendance", "device") && devices.length > 0 && (
                <Link href="/staff/device-sync" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-sky-200 hover:bg-sky-50/40 dark:hover:bg-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><HardDrive className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Device sync</p>
                      <p className="text-xs text-slate-400">{deviceSyncedEmployees}/{totalEmployees} synced</p>
                    </div>
                  </div>
                  {lastSyncAt && (
                    <span className="text-xs text-slate-400">Last sync {formatDate(lastSyncAt, "MMM d, HH:mm")}</span>
                  )}
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {canViewPayroll && (
          <Link href="/payroll" className="block transition hover:scale-[1.01]">
            <StatCard title="Payroll This Month" value={money(payrollNet)} change={latestPayroll ? 2.4 : 0} trend="up" icon={Wallet} />
          </Link>
        )}
        {canViewIncome && (
          <Link href="/income" className="block transition hover:scale-[1.01]">
            <StatCard title="Total Revenue" value={money(revenueThisMonth)} change={pct(revenueThisMonth, revenueLastMonth)} trend={revenueThisMonth >= revenueLastMonth ? "up" : "down"} icon={TrendingUp} />
          </Link>
        )}
        {canViewExpenses && (
          <Link href="/expenses" className="block transition hover:scale-[1.01]">
            <StatCard title="Total Expenses" value={money(expensesThisMonth)} change={pct(expensesThisMonth, expensesLastMonth)} trend={expensesThisMonth > expensesLastMonth ? "up" : "down"} icon={Receipt} />
          </Link>
        )}
        {canViewAccounting && (
          <Link href="/accounting" className="block transition hover:scale-[1.01]">
            <StatCard title="Cash Balance" value={money(cashBalance)} icon={PiggyBank} footer={<p className="text-xs text-slate-400">{safeBankAccounts.length} accounts</p>} />
          </Link>
        )}
        {canViewIncome && (
          <Link href="/invoices" className="block transition hover:scale-[1.01]">
            <StatCard title="Outstanding Invoices" value={money(outstandingInvoices)} icon={FileText} />
          </Link>
        )}
      </div>

      {/* Charts */}
      <div className="mb-4">
        <DashboardCharts data={chartsData} role={session.role} />
      </div>

      {/* ── Recent Activity (Last 5 Audit Logs) ── */}
      <Card className="mb-4">
        <CardBody className="p-4 sm:px-5 sm:py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand-500" /> Recent Activity
            </h3>
            {hasPermission(session, "audit-logs", "view") && (
              <Link href="/audit-logs" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${
                      log.action === "create" ? "bg-emerald-500" :
                      log.action === "update" ? "bg-blue-500" :
                      log.action === "delete" ? "bg-red-500" :
                      "bg-slate-400"
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {log.user?.name ?? "System"} · {log.module}
                      </p>
                      <p className="text-xs text-slate-400">{log.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(log.createdAt, "MMM d, HH:mm")}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Needs attention + recent activity */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <NeedsAttention workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
        <div className="space-y-4">
          <RecentActivity workspaceId={wsId} role={session.role} employeeId={session.employeeId ?? undefined} />
        </div>
      </div>
    </>
  );
}
