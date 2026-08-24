import { format, subDays, endOfDay } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTimeNepal } from "@/lib/utils";
import { EmployeeQuickActions } from "./quick-actions";
import { EmployeeChangePassword } from "./change-password";
import {
  Timer,
  TrendingUp,
  MessageSquare,
  CalendarCheck,
  ArrowRight,
  User,
  Coffee,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ─── Nepal Time Helpers ───────────────────────────────────────────────────────
const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;
function nepalStartOfDay(): Date {
  const npl = new Date(Date.now() + NPL_OFFSET_MS);
  const y = npl.getUTCFullYear();
  const m = npl.getUTCMonth();
  const d = npl.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0));
}

export default async function EmployeePortalPage() {
  const session = await requireSession();

  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: {
      employee: {
        include: { department: true, position: true },
      },
    },
  });

  const employee = user?.employee;
  if (!employee) {
    return (
      <>
        <PageHeader title="Employee Portal" subtitle="Welcome back!" />
        <Card>
          <CardBody className="text-center py-12 text-slate-500">
            <User className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No employee profile found. Please contact your administrator.</p>
          </CardBody>
        </Card>
      </>
    );
  }

  const employeeId = employee.id;
  const today = nepalStartOfDay();
  const sevenDaysAgo = subDays(today, 7);

  // Fetch today's record first (needed for break query)
  const todayRecordData = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });

  // Fetch remaining data in parallel
  const [recentAttendance, recentLeaves, unreadMessages, activeBreak] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        workspaceId: session.workspaceId,
        employeeId,
        date: { gte: sevenDaysAgo, lte: endOfDay(today) },
      },
      orderBy: { date: "desc" },
      take: 7,
    }),
    prisma.leaveRequest.findMany({
      where: { workspaceId: session.workspaceId, employeeId },
      include: { type: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.count({
      where: { workspaceId: session.workspaceId, userId: session.id, readAt: null },
    }),
    todayRecordData
      ? prisma.break.findFirst({
          where: {
            workspaceId: session.workspaceId,
            employeeId,
            attendanceId: todayRecordData.id,
            status: "active",
          },
        })
      : null,
  ]);

  const breakActive = !!activeBreak;

  const leaveData = recentLeaves.map((l) => ({
    id: l.id,
    typeName: l.type.name,
    color: l.type.color,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    days: l.days,
    status: l.status,
    reason: l.reason,
  }));

  return (
    <>
      <PageHeader
        title={`Welcome, ${employee.name}`}
        subtitle={[
          employee.department?.name,
          employee.position?.name,
        ].filter(Boolean).join(" — ") || `Employee ID: ${employee.employeeId}`}
      />

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Status"
          value={todayRecordData ? todayRecordData.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "No Record"}
          icon={CalendarCheck}
          iconClass={todayRecordData?.status === "present" ? "!bg-emerald-100 !text-emerald-600" : ""}
        />
        <StatCard
          title="Hours Today"
          value={todayRecordData ? `${todayRecordData.hours.toFixed(1)}h` : "0h"}
          icon={Timer}
          iconClass={todayRecordData && todayRecordData.hours >= 8 ? "!bg-emerald-100 !text-emerald-600" : ""}
        />
        <StatCard
          title="Overtime"
          value={todayRecordData && todayRecordData.overtime > 0 ? `${todayRecordData.overtime.toFixed(1)}h` : "0h"}
          icon={TrendingUp}
        />
        <StatCard
          title="Unread Messages"
          value={unreadMessages}
          icon={MessageSquare}
        />
      </div>

      {/* Today's Attendance Detail */}
      <Card className="mb-6">
        <CardHeader title="Today's Attendance" subtitle={format(new Date(), "EEEE, MMMM d, yyyy")} />
        <CardBody>
          {todayRecordData ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Check In</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatTimeNepal(todayRecordData.clockIn)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Check Out</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatTimeNepal(todayRecordData.clockOut)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Break</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-slate-900">
                  {todayRecordData.breakMinutes}m
                  {breakActive && <Coffee className="h-4 w-4 text-amber-500" />}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Status</p>
                <div className="mt-1"><StatusBadge status={todayRecordData.status} /></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No attendance recorded today. Use the attendance machine to clock in.</p>
          )}
        </CardBody>
      </Card>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader title="Quick Actions" />
        <CardBody>
          <EmployeeQuickActions
            hasClockedIn={!!todayRecordData?.clockIn}
            hasClockedOut={!!todayRecordData?.clockOut}
            breakActive={breakActive}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Attendance */}
        <Card>
          <CardHeader
            title="Recent Attendance"
            subtitle="Last 7 days"
            action={
              <a href="/attendance" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </a>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">Out</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendance.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No records</td></tr>
                  ) : (
                    recentAttendance.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700">{formatDate(r.date)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTimeNepal(r.clockIn)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTimeNepal(r.clockOut)}</td>
                        <td className="px-4 py-3 text-slate-700">{r.hours.toFixed(1)}h</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* Recent Leave Requests */}
        <Card>
          <CardHeader
            title="Recent Leave Requests"
            subtitle="Your latest requests"
            action={
              <a href="/employee/requests" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </a>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveData.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No leave requests</td></tr>
                  ) : (
                    leaveData.map((l) => (
                      <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                            <span className="font-medium text-slate-700">{l.typeName}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(l.startDate)} — {formatDate(l.endDate)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{l.days}d</td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Change Password */}
      <Card className="mt-6">
        <CardHeader title="Account Security" subtitle="Change your login password" />
        <CardBody>
          <EmployeeChangePassword />
        </CardBody>
      </Card>
    </>
  );
}
