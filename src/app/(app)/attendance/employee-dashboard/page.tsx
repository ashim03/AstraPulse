import { format } from "date-fns";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/page-header";
import { EmployeeAttendanceClient } from "./employee-attendance-client";

export const dynamic = "force-dynamic";

export default async function EmployeeAttendanceDashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "employee_dashboard")) {
    redirect("/?error=access_denied");
  }
  const selectedEmployeeId = typeof searchParams.employeeId === "string" ? searchParams.employeeId : "";
  const selectedMonth = typeof searchParams.month === "string" ? searchParams.month : format(new Date(), "yyyy-MM");

  const employees = await prisma.employee.findMany({
    where: { workspaceId: session.workspaceId, status: "active" },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Employee Attendance"
        subtitle="Detailed attendance view per employee"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Attendance", href: "/attendance" },
              { label: "Employee Dashboard" },
            ]}
          />
        }
      />

      <EmployeeAttendanceClient
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeId: e.employeeId,
          department: e.department?.name ?? "—",
        }))}
        initialEmployeeId={selectedEmployeeId || employees[0]?.id || ""}
        initialMonth={selectedMonth}
      />
    </>
  );
}
