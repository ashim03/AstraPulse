import Link from "next/link";
import { UserPlus, Users, UserCheck, UserMinus, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireSession();
  const employees = await prisma.employee.findMany({
    where: { workspaceId: session.workspaceId },
    include: { department: true, position: true, user: true },
    orderBy: { name: "asc" },
  });

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const contract = employees.filter((e) => e.employmentType === "contract").length;

  const rows: SmartRow[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    department: e.department?.name ?? "—",
    position: e.position?.name ?? "—",
    employmentType: e.employmentType,
    status: e.status,
    joinDate: e.joinDate ? formatDate(e.joinDate, "yyyy-MM-dd") : "",
    salary: e.baseSalary,
    phone: e.phone ?? "—",
  }));

  const columns: SmartColumn[] = [
    { key: "name", header: "Employee", kind: "avatar", avatarSubKey: "email", minWidth: 200 },
    { key: "department", header: "Department", badgeFallback: "" },
    { key: "position", header: "Position" },
    { key: "employmentType", header: "Type", kind: "badge", badgeMap: { full_time: { label: "Full-time" }, part_time: { label: "Part-time" }, contract: { label: "Contract" }, intern: { label: "Intern" }, probation: { label: "Probation" } } },
    { key: "status", header: "Status", kind: "status" },
    { key: "joinDate", header: "Joined", kind: "date" },
    { key: "salary", header: "Salary", kind: "money", align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${total} employees in ${new Set(employees.map((e) => e.department?.name).filter(Boolean)).size} departments`}
        actions={
          <Link href="/staff/new">
            <Button leftIcon={<UserPlus className="h-4 w-4" />}>Add Employee</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Employees" value={total} icon={Users} footer={<p className="text-xs text-slate-400">All employment types</p>} />
        <StatCard title="Active" value={active} icon={UserCheck} footer={<p className="text-xs text-emerald-600">{Math.round((active / Math.max(1, total)) * 100)}% of workforce</p>} />
        <StatCard title="On Leave" value={onLeave} icon={UserMinus} />
        <StatCard title="Contractors" value={contract} icon={Clock} />
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        rowHrefPrefix="/staff/"
        searchKeys={["name", "email", "department", "position"]}
        searchPlaceholder="Search by name, email, department..."
        emptyTitle="No employees found"
        emptyDescription="Add your first employee to get started."
        exportFilename="employees.csv"
        pageSize={10}
      />
    </>
  );
}