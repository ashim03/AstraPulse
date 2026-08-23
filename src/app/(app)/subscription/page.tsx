import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionManager } from "./subscription-manager";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await requireSession();
  const [subscription, employeeCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId: session.workspaceId } }),
    prisma.employee.count({ where: { workspaceId: session.workspaceId, status: { in: ["active", "probation", "on_leave"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Subscription" subtitle="Manage your plan and billing." breadcrumb="Company" />
      <SubscriptionManager
        currentPlan={subscription?.planName ?? "Starter"}
        status={subscription?.status ?? "active"}
        billingPeriod={subscription?.billingPeriod ?? "monthly"}
        employeeLimit={subscription?.employeeLimit ?? 15}
        renewalDate={subscription?.renewalDate ? subscription.renewalDate.toISOString().slice(0, 10) : "—"}
        employeeCount={employeeCount}
      />
    </div>
  );
}