import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmployeeForm } from "../../employee-form";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const [employee, departments, positions] = await Promise.all([
    prisma.employee.findFirst({ where: { id: params.id, workspaceId: session.workspaceId } }),
    prisma.department.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  if (!employee) notFound();

  return (
    <>
      <PageHeader title="Edit Employee" subtitle={employee.name} />
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="p-6">
            <EmployeeForm
              isEdit
              initial={{
                id: employee.id,
                name: employee.name,
                email: employee.email,
                employeeId: employee.employeeId,
                phone: employee.phone ?? "",
                departmentId: employee.departmentId ?? "",
                positionId: employee.positionId ?? "",
                employmentType: employee.employmentType,
                baseSalary: employee.baseSalary,
                joinDate: employee.joinDate ? employee.joinDate.toISOString().slice(0, 10) : "",
                contractEndDate: employee.contractEndDate ? employee.contractEndDate.toISOString().slice(0, 10) : "",
                status: employee.status,
                dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.toISOString().slice(0, 10) : "",
                gender: employee.gender ?? "",
                address: employee.address ?? "",
                emergencyName: employee.emergencyName ?? "",
                emergencyPhone: employee.emergencyPhone ?? "",
                taxId: employee.taxId ?? "",
                bankName: employee.bankName ?? "",
                bankAccountNumber: employee.bankAccountNumber ?? "",
              }}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              positions={positions.map((p) => ({ id: p.id, title: p.name }))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}