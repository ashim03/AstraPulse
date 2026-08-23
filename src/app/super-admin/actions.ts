"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { hashPassword } from "@/lib/auth";

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

export async function addOrganizationAction(input: {
  name: string;
  email: string;
  country?: string;
  currency?: string;
  timezone?: string;
  adminName: string;
  adminEmail: string;
  password: string;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const existing = await prisma.workspace.findFirst({ where: { email: input.email.toLowerCase().trim() } });
  if (existing) return fail("An organization with this email already exists");

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      slug: input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
      country: input.country,
      currency: input.currency ?? "NPR",
      timezone: input.timezone ?? "Asia/Kathmandu",
      status: "pending",
    },
  });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      plan: "starter",
      status: "active",
      isTrial: true,
      trialEndDate: trialEnd,
      paymentStatus: "unpaid",
      price: 0,
      employeeLimit: 15,
      userLimit: 50,
      startDate: new Date(),
      renewalDate: trialEnd,
    },
  });

  const roleDefs = [
    { name: "Workspace Admin", description: "Full workspace management", isSystem: true, permissions: "[\"*\"]" },
    { name: "HR Manager", description: "Employee and attendance management", isSystem: true, permissions: "[\"staff\",\"departments\",\"attendance\",\"leave\",\"holidays\",\"tasks\",\"work-records\",\"advances\",\"documents\",\"announcements\",\"payroll\"]" },
    { name: "Accountant", description: "Financial management", isSystem: true, permissions: "[\"accounting\",\"expenses\",\"income\",\"invoices\",\"payments\",\"reports\",\"banks\"]" },
    { name: "Employee", description: "Self-service access", isSystem: true, permissions: "[\"attendance\",\"leave\",\"work-records\",\"tasks\"]" },
  ];

  const createdRoles = await Promise.all(
    roleDefs.map((r) => prisma.role.create({ data: { ...r, workspaceId: workspace.id } }))
  );

  const adminRole = createdRoles.find((r) => r.name === "Workspace Admin");

  await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      name: input.adminName.trim(),
      email: input.adminEmail.toLowerCase().trim(),
      passwordHash: hashPassword(input.password),
      roleId: adminRole?.id,
      accountType: "organization",
      status: "active",
    },
  });

  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin");
  return ok({ workspaceId: workspace.id }, "Organization created with 7-day trial");
}

export async function activateOrganizationAction(
  workspaceId: string
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status: "active", suspendedAt: null },
  });

  await prisma.subscription.updateMany({
    where: { workspaceId, status: { in: ["trial", "active"] } },
    data: { status: "active" },
  });

  revalidatePath("/super-admin/organizations");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  return ok(undefined, "Organization activated");
}

export async function suspendOrganizationAction(
  workspaceId: string
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status: "suspended", suspendedAt: new Date() },
  });

  await prisma.subscription.updateMany({
    where: { workspaceId },
    data: { status: "suspended" },
  });

  revalidatePath("/super-admin/organizations");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  return ok(undefined, "Organization suspended");
}

export async function approvePaymentAction(
  workspaceId: string,
  amount: number
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub) return fail("No subscription found");

  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);

  await prisma.subscription.update({
    where: { workspaceId },
    data: {
      paymentStatus: "paid",
      status: "active",
      isTrial: false,
      approvedBy: session.id,
      approvedAt: new Date(),
      renewalDate,
      price: amount,
    },
  });

  await prisma.workspace.updateMany({
    where: { id: workspaceId, status: { in: ["pending", "suspended"] } },
    data: { status: "active", suspendedAt: null },
  });

  revalidatePath("/super-admin/organizations");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  revalidatePath("/super-admin/subscriptions");
  return ok(undefined, "Payment approved and subscription activated");
}

export async function updateSubscriptionPriceAction(
  workspaceId: string,
  price: number,
  plan: string,
  employeeLimit: number
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.accountType !== "super_admin") return fail("Unauthorized");

  await prisma.subscription.update({
    where: { workspaceId },
    data: { price, plan, employeeLimit },
  });

  revalidatePath("/super-admin/subscriptions");
  revalidatePath(`/super-admin/organizations/${workspaceId}`);
  return ok(undefined, "Subscription updated");
}
