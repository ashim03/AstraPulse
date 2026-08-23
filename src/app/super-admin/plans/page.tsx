import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PlanManager } from "./plan-manager";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requireSession();

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        subtitle="Create and manage subscription packages"
      />
      <PlanManager plans={plans.map((p: typeof plans[number]) => ({
        ...p,
        features: JSON.parse(p.features || "[]") as string[],
        subscriberCount: p._count.subscriptions,
      }))} />
    </>
  );
}
