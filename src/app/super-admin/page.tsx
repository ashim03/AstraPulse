import Link from "next/link";
import { Building2, Users, CreditCard, UserCheck, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  const session = await requireSession();

  const [workspaces, users, subscriptions, employees] = await Promise.all([
    prisma.workspace.findMany({ include: { subscription: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ select: { id: true, workspaceId: true } }),
    prisma.subscription.findMany({ include: { workspace: true } }),
    prisma.employee.findMany({ select: { id: true, workspaceId: true, status: true } }),
  ]);

  const totalOrganizations = workspaces.length;
  const totalUsers = users.length;
  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length;
  const totalEmployees = employees.length;
  const recentOrgs = workspaces.slice(0, 5);

  const planDistribution = subscriptions.reduce(
    (acc, s) => {
      acc[s.planName] = (acc[s.planName] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyRevenue = subscriptions
    .filter((s) => s.status === "active")
    .reduce((a, b) => a + b.price, 0);

  return (
    <>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="Platform overview and management"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Organizations" value={totalOrganizations} icon={Building2} />
        <StatCard title="Total Users" value={totalUsers} icon={Users} />
        <StatCard title="Active Subscriptions" value={activeSubscriptions} icon={CreditCard} />
        <StatCard title="Total Employees" value={totalEmployees} icon={UserCheck} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Revenue Summary</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{money(monthlyRevenue)}</p>
            <p className="mt-1 text-xs text-slate-500">Monthly recurring from active subscriptions</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Plan Distribution</h3>
            <div className="space-y-2">
              {Object.entries(planDistribution).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="capitalize text-sm text-slate-600 dark:text-slate-400">{plan}</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{count} orgs</span>
                </div>
              ))}
              {Object.keys(planDistribution).length === 0 && (
                <p className="text-xs text-slate-400">No active plans</p>
              )}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Active employees</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{employees.filter((e) => e.status === "active").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Inactive workspaces</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{workspaces.filter((w) => w.status !== "active").length}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Organizations</h3>
            <Link href="/super-admin/organizations" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium text-slate-500">Organization</th>
                  <th className="pb-2 font-medium text-slate-500">Status</th>
                  <th className="pb-2 font-medium text-slate-500">Plan</th>
                  <th className="pb-2 font-medium text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <td className="py-3">
                      <Link href={`/super-admin/organizations/${org.id}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-200">
                        {org.name}
                      </Link>
                      <p className="text-xs text-slate-400">{org.email}</p>
                    </td>
                    <td className="py-3"><StatusBadge status={org.status} /></td>
                     <td className="py-3"><StatusBadge status={org.subscription?.planName ?? "trial"} /></td>
                    <td className="py-3 text-slate-500">{formatDate(org.createdAt)}</td>
                  </tr>
                ))}
                {recentOrgs.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">No organizations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
