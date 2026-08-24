import { format } from "date-fns";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceStatsForDay } from "@/services/attendance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { AttendanceDayPicker } from "./attendance-day-picker";
import { ClockButtons } from "./clock-buttons";
import { AttendanceStats } from "./attendance-stats";
import { getDataScope, hasPermission } from "@/lib/permissions";
import { formatTimeNepal } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;

function getNepalDay(date: Date): Date {
  const npl = new Date(date.getTime() + NPL_OFFSET_MS);
  npl.setHours(0, 0, 0, 0);
  return new Date(npl.getTime() - NPL_OFFSET_MS);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "view")) {
    redirect("/?error=access_denied");
  }

  const scope = getDataScope(session);
  const now = new Date();
  const selected = searchParams.date ? getNepalDay(new Date(searchParams.date)) : getNepalDay(now);
  const dayKey = format(selected, "yyyy-MM-dd");

  const employeeWhere: Record<string, unknown> = { workspaceId: session.workspaceId };
  if (scope === "department" && session.departmentId) {
    employeeWhere.departmentId = session.departmentId;
  } else if (scope === "self") {
    employeeWhere.id = session.employeeId ?? "__none__";
  }

  const attendanceWhere: Record<string, unknown> = { workspaceId: session.workspaceId, date: selected };
  if (scope === "department" && session.departmentId) {
    attendanceWhere.employee = { departmentId: session.departmentId };
  } else if (scope === "self") {
    attendanceWhere.employeeId = session.employeeId ?? "__none__";
  }

  const [stats, employees, records, user] = await Promise.all([
    attendanceStatsForDay(session.workspaceId, selected),
    prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, name: true, department: { select: { name: true } } },
    }),
    prisma.attendance.findMany({
      where: attendanceWhere,
      include: { employee: { select: { id: true, name: true, department: { select: { name: true } } } } },
      orderBy: { clockIn: "asc" },
    }),
    prisma.user.findFirst({ where: { id: session.id, workspaceId: session.workspaceId }, include: { employee: true } }),
  ]);

  const recordsMap = new Map(records.map((r) => [r.employeeId, r]));

  const myRecord = records.find((r) => r.employeeId === user?.employeeId);

  // Get break status for current user
  let breakActive = false;
  let breakUsed = false;
  if (myRecord) {
    const breaks = await prisma.break.findMany({
      where: { attendanceId: myRecord.id },
    });
    breakActive = breaks.some((b) => b.status === "active");
    breakUsed = breaks.some((b) => b.status === "completed" || b.status === "exceeded");
  }

  const rows: SmartRow[] = employees.map((e) => {
    const record = recordsMap.get(e.id);
    return {
      id: e.id,
      name: e.name,
      department: (e as any).department?.name ?? "—",
      clockIn: formatTimeNepal(record?.clockIn),
      clockOut: formatTimeNepal(record?.clockOut),
      hours: (record?.hours ?? 0).toFixed(2),
      status: record?.status ?? "absent",
      source: record?.source ?? "system",
      note: record?.note ?? "—",
      employeeId: e.id,
    };
  });

  const columns: SmartColumn[] = [
    { key: "name", header: "Employee", kind: "avatar", avatarSubKey: "department", minWidth: 200 },
    { key: "department", header: "Department" },
    { key: "clockIn", header: "Clock In" },
    { key: "clockOut", header: "Clock Out" },
    { key: "hours", header: "Hours", align: "right" },
    { key: "status", header: "Status", kind: "status" },
  ];

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`Records for ${format(selected, "EEEE, MMMM d, yyyy")} (Nepal Time)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ClockButtons
              myRecord={myRecord ? { clockIn: !!myRecord.clockIn, clockOut: !!myRecord.clockOut, breakActive, breakUsed } : null}
              hasEmployee={!!user?.employeeId}
            />
            <AttendanceDayPicker selected={dayKey} />
          </div>
        }
      />

      <AttendanceStats stats={stats} employees={employees.length} />

      <Card>
        <CardHeader title="Daily Records" subtitle={`${records.length} attendance entries + ${employees.length - records.length} employees for ${dayKey}`} />
        <CardBody className="p-0">
          <SmartTable
            rows={rows}
            columns={columns}
            rowKey="id"
            searchKeys={["name", "department"]}
            searchPlaceholder="Search by employee..."
            emptyTitle="No employees found"
            emptyDescription="All employees listed above. Employees with no record are marked absent."
            exportFilename={`attendance-${dayKey}.csv`}
            showToolbar
            pageSize={employees.length}
          />
        </CardBody>
      </Card>

    </>
  );
}
