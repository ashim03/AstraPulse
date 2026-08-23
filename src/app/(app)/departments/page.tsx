import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { DepartmentManager, type DepartmentRow } from "./department-manager";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "departments", "view")) {
    redirect("/?error=access_denied");
  }
  const departments = await prisma.department.findMany({
    where: { workspaceId: session.workspaceId },
    include: {
      manager: true,
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows: DepartmentRow[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    manager: d.manager?.name ?? null,
    employeeCount: d._count.employees,
    budget: 0,
  }));

  const totalEmployees = departments.reduce((a, b) => a + b._count.employees, 0);

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} departments · ${totalEmployees} employees`}
      />
      <DepartmentManager initial={rows} />
    </>
  );
}