import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/page-header";
import { AttendanceReportsClient } from "./attendance-reports-client";

export const dynamic = "force-dynamic";

export default async function AttendanceReportsPage() {
  const session = await requireSession();

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId: session.workspaceId },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Attendance Reports"
        subtitle="Generate and export detailed attendance reports"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Attendance", href: "/attendance" },
              { label: "Reports" },
            ]}
          />
        }
      />

      <AttendanceReportsClient
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeId: e.employeeId,
          department: e.department?.name || "—",
        }))}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
        }))}
      />
    </>
  );
}
