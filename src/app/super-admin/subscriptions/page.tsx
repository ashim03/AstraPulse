import Link from "next/link";
import { CreditCard, TrendingUp, Users, ChevronRight, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await requireSession();

  const subscriptions = await prisma.subscription.findMany({
    include: { workspace: true },
    orderBy: { renewalDate: "asc" },
  });

  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const totalRevenue = activeSubs.reduce((a, b) => a + b.price, 0);
  const trialSubs = subscriptions.filter((s) => s.isTrial);

  const planDistribution = subscriptions.reduce(
    (acc, s) => {
      acc[s.plan] = (acc[s.plan] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage platform subscriptions and billing"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Subscriptions" value={activeSubs.length} icon={CreditCard} />
        <StatCard title="Monthly Revenue" value={money(totalRevenue)} icon={TrendingUp} />
        <StatCard title="On Trial" value={trialSubs.length} icon={Clock} />
        <StatCard title="Avg. Plan Value" value={activeSubs.length ? money(totalRevenue / activeSubs.length) : "—"} icon={Users} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {["starter", "growth", "pro"].map((plan) => (
          <Card key={plan}>
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={plan} />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{planDistribution[plan] ?? 0}</span>
              </div>
              <p className="text-xs text-slate-500">organizations on {plan} plan</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium text-slate-500">Organization</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Plan</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Payment</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Price</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Employee Limit</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Renewal</th>
                  <th className="px-5 py-3 font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/super-admin/organizations/${sub.workspaceId}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-200">
                        {sub.workspace.name}
                      </Link>
                      <p className="text-xs text-slate-400">{sub.workspace.email}</p>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={sub.plan} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={sub.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={sub.paymentStatus} />
                        {sub.isTrial && (
                          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Trial
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{money(sub.price)}/mo</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{sub.employeeLimit}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(sub.renewalDate)}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/super-admin/organizations/${sub.workspaceId}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      No subscriptions found
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
