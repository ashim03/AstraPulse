"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions";

export async function createPlanAction(input: {
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  employeeLimit: number;
  userLimit: number;
  storageLimit: number;
  features: string[];
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const existing = await prisma.subscriptionPlan.findFirst({ where: { name: input.name } });
  if (existing) return fail("A plan with this name already exists");

  const maxSort = await prisma.subscriptionPlan.aggregate({ _max: { sortOrder: true } });

  await prisma.subscriptionPlan.create({
    data: {
      name: input.name.trim(),
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      yearlyPrice: input.yearlyPrice,
      employeeLimit: input.employeeLimit,
      userLimit: input.userLimit,
      storageLimit: input.storageLimit,
      features: JSON.stringify(input.features),
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/super-admin/plans");
  return ok(undefined, "Plan created");
}

export async function updatePlanAction(
  planId: string,
  input: {
    name: string;
    description?: string;
    monthlyPrice: number;
    yearlyPrice: number;
    employeeLimit: number;
    userLimit: number;
    storageLimit: number;
    features: string[];
    isActive: boolean;
  }
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: {
      name: input.name.trim(),
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      yearlyPrice: input.yearlyPrice,
      employeeLimit: input.employeeLimit,
      userLimit: input.userLimit,
      storageLimit: input.storageLimit,
      features: JSON.stringify(input.features),
      isActive: input.isActive,
    },
  });

  revalidatePath("/super-admin/plans");
  return ok(undefined, "Plan updated");
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: { _count: { select: { subscriptions: true } } },
  });

  if (!plan) return fail("Plan not found");
  if (plan._count.subscriptions > 0) return fail("Cannot delete plan with active subscribers");

  await prisma.subscriptionPlan.delete({ where: { id: planId } });

  revalidatePath("/super-admin/plans");
  return ok(undefined, "Plan deleted");
}
