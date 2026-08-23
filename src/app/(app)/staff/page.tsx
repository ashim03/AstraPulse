import Link from "next/link";
import { UserPlus, Users, UserCheck, UserMinus, Clock, MailCheck, MailX } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { StaffFilters } from "./staff-filters";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();

  const letter = typeof searchParams.letter === "string" ? searchParams.letter : "";
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const departmentFilter = typeof searchParams.department === "string" ? searchParams.department : "";
  const employmentType = typeof searchParams.employmentType === "string" ? searchParams.employmentType : "";
  const statusFilter = typeof searchParams.status === "string" ? searchParams.status : "";
  const gender = typeof searchParams.gender === "string" ? searchParams.gender : "";
  const sortBy = typeof searchParams.sortBy === "string" ? searchParams.sortBy : "name";
  const sortOrder = typeof searchParams.sortOrder === "string" ? searchParams.sortOrder : "asc";
  const verificationFilter = typeof searchParams.verification === "string" ? searchParams.verification : "";
  const accountStatusFilter = typeof searchParams.accountStatus === "string" ? searchParams.accountStatus : "";

  const where: Record<string, unknown> = { workspaceId: session.workspaceId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { employeeId: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (departmentFilter) where.departmentId = departmentFilter;
  if (employmentType) where.employmentType = employmentType;
  if (statusFilter) where.status = statusFilter;
  if (gender) where.gender = gender;
  if (letter) where.name = { startsWith: letter, mode: "insensitive" };

  if (verificationFilter === "verified") {
    where.user = { is: { emailVerified: true } };
  } else if (verificationFilter === "unverified") {
    where.user = { is: { emailVerified: false } };
  }

  if (accountStatusFilter) {
    where.user = { ...(where.user as Record<string, unknown>), is: { status: accountStatusFilter } };
  }

  const orderBy: Record<string, string> = { [sortBy]: sortOrder };

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: true,
        position: true,
        user: {
          select: {
            emailVerified: true,
            emailVerifiedAt: true,
            status: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy,
    }),
    prisma.department.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { name: "asc" },
    }),
  ]);

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const contract = employees.filter((e) => e.employmentType === "contract").length;
  const verifiedCount = employees.filter((e) => e.user?.emailVerified).length;
  const unverifiedCount = employees.filter((e) => e.user && !e.user.emailVerified).length;

  const rows: SmartRow[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    employeeId: e.employeeId,
    department: e.department?.name ?? "—",
    position: e.position?.name ?? "—",
    employmentType: e.employmentType,
    status: e.status,
    joinDate: e.joinDate ? formatDate(e.joinDate, "yyyy-MM-dd") : "",
    salary: e.baseSalary,
    emailVerified: e.user?.emailVerified ?? false,
    accountStatus: e.user?.status ?? "active",
    lastLogin: e.user?.lastLoginAt ? formatDate(e.user.lastLoginAt, "MMM dd, yyyy HH:mm") : "Never",
  }));

  const columns: SmartColumn[] = [
    {
      key: "name",
      header: "Employee",
      kind: "avatar",
      avatarSubKey: "employeeId",
      minWidth: 200,
    },
    { key: "department", header: "Department", badgeFallback: "" },
    { key: "position", header: "Position" },
    {
      key: "employmentType",
      header: "Type",
      kind: "badge",
      badgeMap: {
        full_time: { label: "Full-time" },
        part_time: { label: "Part-time" },
        contract: { label: "Contract" },
        intern: { label: "Intern" },
        probation: { label: "Probation" },
      },
    },
    {
      key: "emailVerified",
      header: "Email Verified",
      kind: "badge",
      badgeMap: {
        true: { label: "Verified", tone: "green" },
        false: { label: "Unverified", tone: "red" },
      },
      badgeFallback: "Pending",
    },
    {
      key: "accountStatus",
      header: "Account Status",
      kind: "badge",
      badgeMap: {
        active: { label: "Active", tone: "green" },
        inactive: { label: "Inactive", tone: "red" },
        pending: { label: "Pending", tone: "amber" },
      },
    },
    { key: "lastLogin", header: "Last Login" },
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

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Employees"
          value={total}
          icon={Users}
          footer={<p className="text-xs text-slate-400">All employment types</p>}
        />
        <StatCard
          title="Active"
          value={active}
          icon={UserCheck}
          footer={
            <p className="text-xs text-emerald-600">
              {Math.round((active / Math.max(1, total)) * 100)}% of workforce
            </p>
          }
        />
        <StatCard title="On Leave" value={onLeave} icon={UserMinus} />
        <StatCard
          title="Verified"
          value={verifiedCount}
          icon={MailCheck}
          footer={
            <Badge tone="green" dot className="mt-1">
              Email verified
            </Badge>
          }
        />
        <StatCard
          title="Unverified"
          value={unverifiedCount}
          icon={MailX}
          footer={
            <Badge tone="red" dot className="mt-1">
              Pending verification
            </Badge>
          }
        />
      </div>

      <StaffFilters departments={departments} />

      <div className="mt-4">
        <SmartTable
          rows={rows}
          columns={columns}
          rowKey="id"
          rowHrefPrefix="/staff/"
          searchKeys={["name", "email", "department", "position", "employeeId"]}
          searchPlaceholder="Search by name, email, department..."
          filters={[
            {
              key: "emailVerified",
              label: "Verification Status",
              options: [
                { value: "true", label: "Verified" },
                { value: "false", label: "Unverified" },
              ],
            },
            {
              key: "accountStatus",
              label: "Account Status",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "pending", label: "Pending" },
              ],
            },
          ]}
          emptyTitle="No employees found"
          emptyDescription="Add your first employee to get started."
          exportFilename="employees.csv"
          pageSize={10}
        />
      </div>
    </>
  );
}
