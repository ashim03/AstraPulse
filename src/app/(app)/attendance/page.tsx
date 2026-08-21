import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceStatsForDay } from "@/services/attendance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { AttendanceDayPicker } from "./attendance-day-picker";
import { ClockButtons } from "./clock-buttons";
import { LogIn, LogOut } from "lucide-react";
import { AttendanceStats } from "./attendance-stats";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = await requireSession();
  const selected = searchParams.date ? new Date(searchParams.date) : new Date();
  const dayKey = format(selected, "yyyy-MM-dd");

  const [stats, employees, records, user] = await Promise.all([
    attendanceStatsForDay(session.workspaceId, selected),
    prisma.employee.findMany({ where: { workspaceId: session.workspaceId }, include: { department: true } }),
    prisma.attendance.findMany({
      where: { workspaceId: session.workspaceId, date: selected },
      include: { employee: { include: { department: true } } },
      orderBy: { clockIn: "asc" },
    }),
    prisma.user.findFirst({ where: { id: session.id, workspaceId: session.workspaceId }, include: { employee: true } }),
  ]);

  const myRecord = records.find((r) => r.employeeId === user?.employeeId);

  const rows: SmartRow[] = records.map((r) => ({
    id: r.id,
    name: r.employee.name,
    department: r.employee.department?.name ?? "—",
    clockIn: r.clockIn ? format(r.clockIn, "h:mm a") : "—",
    clockOut: r.clockOut ? format(r.clockOut, "h:mm a") : "—",
    hours: r.hours.toFixed(2),
    status: r.status,
    source: r.source,
    note: r.note ?? "—",
  }));

  const columns: SmartColumn[] = [
    { key: "name", header: "Employee", kind: "avatar", avatarSubKey: "department", minWidth: 200 },
    { key: "department", header: "Department" },
    { key: "clockIn", header: "Clock In" },
    { key: "clockOut", header: "Clock Out" },
    { key: "hours", header: "Hours", align: "right" },
    { key: "source", header: "Source", kind: "badge", badgeMap: { self: { label: "Self", tone: "green" }, manual: { label: "Manual", tone: "sky" } }, badgeFallback: "Manual" },
    { key: "status", header: "Status", kind: "status" },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`Records for ${format(selected, "EEEE, MMMM d, yyyy")}`}
        actions={
          <div className="flex items-center gap-2">
            <ClockButtons
              myRecord={myRecord ? { clockIn: !!myRecord.clockIn, clockOut: !!myRecord.clockOut } : null}
              hasEmployee={!!user?.employeeId}
            />
            <AttendanceDayPicker selected={dayKey} />
          </div>
        }
      />

      <AttendanceStats stats={stats} employees={employees.length} />

      <Card>
        <CardHeader title="Daily Records" subtitle={`${records.length} attendance entries for ${dayKey}`} />
        <CardBody className="p-0">
          <SmartTable
            rows={rows}
            columns={columns}
            rowKey="id"
            searchKeys={["name", "department"]}
            searchPlaceholder="Search by employee..."
            emptyTitle="No records for this day"
            emptyDescription="Attendance records will appear here once employees clock in."
            exportFilename={`attendance-${dayKey}.csv`}
            showToolbar
            pageSize={10}
          />
        </CardBody>
      </Card>
    </>
  );
}