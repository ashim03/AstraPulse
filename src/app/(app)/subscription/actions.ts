"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { PLANS } from "@/lib/constants";

export async function changePlanAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }
  if (!hasPermission(session, "subscription", "manage")) {
    await writeAudit({ session, action: "denied", module: "subscription", description: "Permission denied: subscription:manage" });
    return fail("You don't have permission to change subscription plan");
  }
  const plan = String(formData.get("plan") ?? "");
  const period = String(formData.get("period") ?? "monthly");
  const planInfo = PLANS.find((p) => p.name.toLowerCase() === plan.toLowerCase());
  if (!planInfo) return fail("Unknown plan");

  const subscription = await prisma.subscription.upsert({
    where: { workspaceId: session.workspaceId },
    create: {
      workspaceId: session.workspaceId,
      planName: planInfo.name,
      status: "active",
      billingPeriod: period,
      price: period === "yearly" ? planInfo.yearly : planInfo.monthly,
      employeeLimit: planInfo.employeeLimit,
      renewalDate: new Date(Date.now() + (period === "yearly" ? 365 : 30) * 86400000),
    },
    update: {
      planName: planInfo.name,
      billingPeriod: period,
      price: period === "yearly" ? planInfo.yearly : planInfo.monthly,
      employeeLimit: planInfo.employeeLimit,
      status: "active",
      renewalDate: new Date(Date.now() + (period === "yearly" ? 365 : 30) * 86400000),
    },
  });

  await writeAudit({ session, action: "update", module: "subscription", recordId: subscription.id, description: `Changed plan to ${planInfo.name} (${period})` });
  revalidatePath("/subscription");
  return ok(undefined, "Plan updated");
}

export async function cancelSubscriptionAction(): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return fail("Authentication required");
  }
  if (!hasPermission(session, "subscription", "manage")) {
    await writeAudit({ session, action: "denied", module: "subscription", description: "Permission denied: subscription:manage" });
    return fail("You don't have permission to cancel subscription");
  }
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId: session.workspaceId } });
  if (!subscription) return fail("No active subscription");
  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "cancelled" } });
  await writeAudit({ session, action: "update", module: "subscription", recordId: subscription.id, description: "Cancelled subscription" });
  revalidatePath("/subscription");
  return ok(undefined, "Subscription cancelled");
}