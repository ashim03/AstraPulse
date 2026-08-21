import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmployeeForm } from "../employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const session = await requireSession();
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Add Employee" subtitle="Create a new employee record and login account" />
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="p-6">
            <EmployeeForm
              initial={{ name: "", email: "" }}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              positions={positions.map((p) => ({ id: p.id, title: p.name }))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}