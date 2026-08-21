import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin, CreditCard, Briefcase, Cake, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, formatDate, padNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Timeline } from "@/components/ui/timeline";
import { DeleteButton } from "@/components/app/delete-button";
import { Button } from "@/components/ui/button";
import { deleteEmployeeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const employee = await prisma.employee.findFirst({
    where: { id: params.id, workspaceId: session.workspaceId },
    include: {
      department: true,
      position: true,
      user: true,
      leaveRequests: { include: { type: true }, orderBy: { createdAt: "desc" }, take: 4 },
      advances: { orderBy: { date: "desc" }, take: 4 },
      payrollItems: { include: { payroll: true }, orderBy: { payroll: { period: "desc" } }, take: 6 },
      workRecords: { orderBy: { date: "desc" }, take: 5 },
    },
  });
  if (!employee) notFound();

  const totalLeaveDays = employee.leaveRequests.filter((l) => l.status === "approved").reduce((a, b) => a + b.days, 0);
  const outstandingAdvances = employee.advances.reduce((a, b) => a + b.outstanding, 0);
  const totalWorkedHours = employee.workRecords.reduce((a, b) => a + b.hours, 0);

  const recentAttendance = await prisma.attendance.findMany({
    where: { employeeId: employee.id, workspaceId: session.workspaceId },
    orderBy: { date: "desc" },
    take: 30,
    select: { overtime: true },
  });
  const totalOvertimeHours = recentAttendance.reduce((a, b) => a + b.overtime, 0);

  const editHref = `/staff/${employee.id}/edit`;

  return (
    <>
      <PageHeader
        title={employee.name}
        subtitle={`${employee.employeeId} · ${employee.position?.name ?? "No position"}`}
        actions={
          <>
            <Link href={editHref}>
              <Button variant="secondary" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>Edit</Button>
            </Link>
            <DeleteButton id={employee.id} action={deleteEmployeeAction} confirmText={`Delete ${employee.name}? This will also remove their login and records.`} label="Delete" />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="px-5 py-6 text-center">
            <div className="mx-auto mb-3 flex justify-center">
              <Avatar name={employee.name} size="lg" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{employee.name}</h3>
            <p className="text-sm text-slate-500">{employee.position?.name ?? "—"}</p>
            <div className="mt-2 flex justify-center">
              <Badge tone={employee.status === "active" ? "green" : employee.status === "on_leave" ? "amber" : "red"}>
                {employee.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="mt-5 space-y-2.5 text-left text-sm">
              {employee.email && (
                <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Mail className="h-4 w-4 text-slate-400" />{employee.email}</p>
              )}
              {employee.phone && (
                <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Phone className="h-4 w-4 text-slate-400" />{employee.phone}</p>
              )}
              {employee.address && (
                <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><MapPin className="h-4 w-4 text-slate-400" />{employee.address}</p>
              )}
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Briefcase className="h-4 w-4 text-slate-400" />{employee.department?.name ?? "No department"}</p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Cake className="h-4 w-4 text-slate-400" />{employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "—"}</p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><CalendarDays className="h-4 w-4 text-slate-400" />Joined {formatDate(employee.joinDate)}</p>
            </div>
            <div className="mt-5 rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Annual Salary</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{money(employee.baseSalary)}</p>
              <p className="text-xs text-slate-400">{employee.employmentType.replace("_", " ")}</p>
            </div>
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard title="Approved Leave" value={`${totalLeaveDays}d`} icon={CalendarDays} />
            <StatCard title="Outstanding Advances" value={money(outstandingAdvances)} icon={CreditCard} />
<StatCard title="Time Worked (last 5)" value={`${totalWorkedHours.toFixed(1)}h`} icon={Briefcase} />
                        <StatCard title="Overtime (last 5)" value={`${totalOvertimeHours}h`} icon={CalendarDays} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Recent Leave" subtitle="Latest leave requests" action={<Link href="/leave" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
              <CardBody className="divide-y divide-slate-50 px-5 py-2">
                {employee.leaveRequests.length === 0 && <p className="py-3 text-sm text-slate-400">No leave requests yet.</p>}
                {employee.leaveRequests.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{l.type.name}</p>
                      <p className="text-xs text-slate-400">{formatDate(l.startDate)} → {formatDate(l.endDate)}</p>
                    </div>
                    <Badge tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Payroll History" subtitle="Recent pay runs" action={<Link href="/payroll" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
              <CardBody className="divide-y divide-slate-50 px-5 py-2">
                {employee.payrollItems.length === 0 && <p className="py-3 text-sm text-slate-400">No payroll history yet.</p>}
                {employee.payrollItems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatDate(new Date(p.payroll.period + "-01"), "MMM yyyy")}</p>
                      <p className="text-xs text-slate-400">Net pay</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">{money(p.net)}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent Activity" subtitle="Advances and work records" />
        <CardBody>
          <Timeline
            items={[
              ...employee.advances.map((a) => ({
                id: a.id,
                title: `Advance of ${money(a.amount)} (${a.reason ?? "salary advance"})`,
                timestamp: a.date,
                tone: "indigo" as const,
              })),
              ...employee.workRecords.map((w) => ({
                id: w.id,
                title: `Worked ${w.hours.toFixed(1)}h on ${formatDate(w.date, "MMM d")}`,
                timestamp: w.date,
                tone: "indigo" as const,
              })),
            ]}
          />
        </CardBody>
      </Card>
    </>
  );
}