import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LeaveManager } from "./leave-manager";
import { CalendarCheck, Hourglass, CalendarX, UserCheck } from "lucide-react";
import type { SmartRow } from "@/components/app/smart-table";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const session = await requireSession();
  const wsId = session.workspaceId;
  const year = new Date().getFullYear();

  const [requests, types, employees, user] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { workspaceId: wsId },
      include: { employee: { include: { department: true } }, type: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveType.findMany({ where: { workspaceId: wsId }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { workspaceId: wsId, status: "active" }, orderBy: { name: "asc" } }),
    prisma.user.findFirst({ where: { id: session.id, workspaceId: wsId }, include: { employee: true } }),
  ]);

  const canApprove = hasPermission(session, "leave", "approve");

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedDays = requests.filter((r) => r.status === "approved" && r.startDate.getFullYear() === year).reduce((a, b) => a + b.days, 0);
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const myRequests = requests.filter((r) => r.employeeId === user?.employeeId);

  const rows: SmartRow[] = requests.map((r) => ({
    id: r.id,
    name: r.employee.name,
    department: r.employee.department?.name ?? "—",
    type: r.type.name,
    startDate: format(r.startDate, "yyyy-MM-dd"),
    endDate: format(r.endDate, "yyyy-MM-dd"),
    days: r.days,
    status: r.status,
    reason: r.reason ?? "—",
  }));

  return (
    <>
      <PageHeader title="Leave & Time Off" subtitle={`${pendingCount} request(s) pending approval`} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pending Approvals" value={pendingCount} icon={Hourglass} />
        <StatCard title="Approved Days" value={`${approvedDays}d`} icon={CalendarCheck} />
        <StatCard title="Rejected" value={rejectedCount} icon={CalendarX} />
        <StatCard title="My Requests" value={myRequests.length} icon={UserCheck} />
      </div>

      {user?.employee && (
        <Card className="mb-4">
          <CardHeader title="My Leave Balances" subtitle="Remaining days this year" />
          <CardBody className="flex flex-wrap gap-3 px-5 py-4">
            {types.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.daysPerYear}d/year</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <LeaveManager
        rows={rows}
        types={types.map((t) => ({ id: t.id, name: t.name, daysPerYear: t.daysPerYear }))}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        canApprove={canApprove}
      />
    </>
  );
}