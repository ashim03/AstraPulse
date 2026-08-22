"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions";

export async function updateOrganizationStatus(
  workspaceId: string,
  status: string
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status },
  });

  revalidatePath("/super-admin/organizations");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  return ok(undefined, `Organization ${status === "active" ? "activated" : "deactivated"}`);
}

export async function updateSubscriptionPlan(
  workspaceId: string,
  plan: string,
  price: number,
  employeeLimit: number
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.subscription.upsert({
    where: { workspaceId },
    update: { plan, price, employeeLimit, status: "active" },
    create: {
      workspaceId,
      plan,
      price,
      employeeLimit,
      status: "active",
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  revalidatePath("/super-admin/subscriptions");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  return ok(undefined, "Subscription updated");
}
