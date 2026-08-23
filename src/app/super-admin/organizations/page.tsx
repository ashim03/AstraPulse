import Link from "next/link";
import { Building2, Users, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AddOrganizationForm } from "../add-organization-form";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status } = await searchParams;
  const filterStatus = status ?? "all";

  const workspaces = await prisma.workspace.findMany({
    where: filterStatus !== "all" ? { status: filterStatus } : undefined,
    include: {
      subscription: true,
      users: { select: { id: true } },
      employees: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = await prisma.workspace.count();
  const active = await prisma.workspace.count({ where: { status: "active" } });
  const pending = await prisma.workspace.count({ where: { status: "pending" } });
  const suspended = await prisma.workspace.count({ where: { status: "suspended" } });
  const totalUsers = workspaces.reduce((a, b) => a + b.users.length, 0);
  const totalEmployees = workspaces.reduce((a, b) => a + b.employees.length, 0);

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle={`${total} registered organizations across the platform`}
        actions={<AddOrganizationForm />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Organizations" value={total} icon={Building2} />
        <StatCard title="Active" value={active} icon={Building2} />
        <StatCard title="Pending" value={pending} icon={Building2} />
        <StatCard title="Suspended" value={suspended} icon={Building2} />
      </div>

      <div className="mb-4 flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "pending", label: "Pending" },
          { key: "suspended", label: "Suspended" },
        ].map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/super-admin/organizations" : `/super-admin/organizations?status=${f.key}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === f.key
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium text-slate-500">Organization</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Plan</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Payment</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Users</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Employees</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Created</th>
                  <th className="px-5 py-3 font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((ws) => (
                  <tr key={ws.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                          {ws.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/super-admin/organizations/${ws.id}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-200">
                            {ws.name}
                          </Link>
                          <p className="truncate text-xs text-slate-400">{ws.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={ws.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={ws.subscription?.plan ?? "none"} />
                        {ws.subscription?.isTrial && (
                          <span className="text-[10px] text-amber-600 font-medium">7-day trial</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={ws.subscription?.paymentStatus ?? "unpaid"} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{ws.users.length}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{ws.employees.length}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(ws.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/super-admin/organizations/${ws.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {workspaces.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      No organizations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
