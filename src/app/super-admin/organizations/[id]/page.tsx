import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Users, CreditCard, Mail, MapPin, Globe, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, money } from "@/lib/utils";
import { PageHeader, Breadcrumb } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrganizationActions } from "../../organization-actions";

export const dynamic = "force-dynamic";

function daysRemaining(date: Date): number {
  const now = new Date();
  const end = new Date(date);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      subscription: true,
      users: { select: { id: true, name: true, email: true, status: true, accountType: true, lastLoginAt: true, createdAt: true } },
      employees: { select: { id: true, name: true, status: true }, orderBy: { name: "asc" } },
    },
  });

  if (!workspace) notFound();

  const activeUsers = workspace.users.filter((u) => u.status === "active").length;
  const activeEmployees = workspace.employees.filter((e) => e.status === "active").length;
  const sub = workspace.subscription;
  const trialDaysLeft = sub?.isTrial && sub.trialEndDate ? daysRemaining(sub.trialEndDate) : null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Organizations", href: "/super-admin/organizations" },
          { label: workspace.name },
        ]}
      />
      <PageHeader
        title={workspace.name}
        subtitle={workspace.email}
        actions={
          <div className="flex items-center gap-2">
            <OrganizationActions
              workspaceId={workspace.id}
              status={workspace.status}
              subscription={sub ? { plan: sub.plan, price: sub.price, employeeLimit: sub.employeeLimit, isTrial: sub.isTrial, paymentStatus: sub.paymentStatus, trialEndDate: sub.trialEndDate } : null}
            />
            <Link href="/super-admin/organizations">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
                {workspace.name.charAt(0)}
              </span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{workspace.name}</p>
                <StatusBadge status={workspace.status} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Mail className="h-4 w-4 text-slate-400" /> {workspace.email}
              </div>
              {workspace.country && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Globe className="h-4 w-4 text-slate-400" /> {workspace.country}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <MapPin className="h-4 w-4 text-slate-400" /> {workspace.timezone} · {workspace.currency}
              </div>
              <div className="text-xs text-slate-400">
                Created {formatDate(workspace.createdAt)}
              </div>
              {workspace.suspendedAt && (
                <div className="text-xs text-red-500">
                  Suspended {formatDate(workspace.suspendedAt)}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <CreditCard className="h-4 w-4 text-brand-500" /> Subscription
            </h3>
            {sub ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Plan</span>
                  <StatusBadge status={sub.plan} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Payment</span>
                  <StatusBadge status={sub.paymentStatus} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Price</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{money(sub.price)}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Employee limit</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{sub.employeeLimit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Renewal</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{formatDate(sub.renewalDate)}</span>
                </div>

                {sub.isTrial && sub.trialEndDate && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      Trial Period
                    </div>
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                      {trialDaysLeft !== null && trialDaysLeft > 0
                        ? `${trialDaysLeft} day${trialDaysLeft > 1 ? "s" : ""} remaining (ends ${formatDate(sub.trialEndDate)})`
                        : `Trial expired on ${formatDate(sub.trialEndDate)}`}
                    </p>
                  </div>
                )}

                {sub.approvedBy && (
                  <div className="text-xs text-slate-400">
                    Last approved {sub.approvedAt ? formatDate(sub.approvedAt) : "—"}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No active subscription</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Overview</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Users className="h-4 w-4" /></span>
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{workspace.users.length}</p>
                  <p className="text-xs text-slate-400">{activeUsers} active users</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><Building2 className="h-4 w-4" /></span>
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{workspace.employees.length}</p>
                  <p className="text-xs text-slate-400">{activeEmployees} active employees</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Users ({workspace.users.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium text-slate-500">Name</th>
                  <th className="pb-2 font-medium text-slate-500">Email</th>
                  <th className="pb-2 font-medium text-slate-500">Type</th>
                  <th className="pb-2 font-medium text-slate-500">Status</th>
                  <th className="pb-2 font-medium text-slate-500">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {workspace.users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{user.name}</td>
                    <td className="py-2.5 text-slate-500">{user.email}</td>
                    <td className="py-2.5"><StatusBadge status={user.accountType} /></td>
                    <td className="py-2.5"><StatusBadge status={user.status} /></td>
                    <td className="py-2.5 text-slate-400 text-xs">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</td>
                  </tr>
                ))}
                {workspace.users.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
