import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ROLE_DEFS, DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_LEAVE_TYPES } from "@/lib/constants";

export type BootstrapInput = {
  companyName: string;
  email: string;
  adminName: string;
  phone?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  businessType?: string;
  password: string;
  plan?: string;
};

export async function bootstrapWorkspace(input: BootstrapInput) {
  const slug = `${input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name: input.companyName,
      email: input.email,
      slug,
      phone: input.phone,
      country: input.country,
      currency: input.currency ?? "USD",
      timezone: input.timezone ?? "America/New_York",
      businessType: input.businessType,
      status: "active",
    },
  });

  // System roles
  const roleIds: Record<string, string> = {};
  for (const r of ROLE_DEFS) {
    const role = await prisma.role.create({
      data: {
        workspaceId: workspace.id,
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: Array.isArray(r.permissions)
          ? JSON.stringify(
              r.permissions.flatMap((m: string) =>
                ["view", "create", "edit", "delete", "approve", "export", "manage"].map((a) => `${m}:${a}`)
              )
            )
          : JSON.stringify(["*"]),
      },
    });
    roleIds[r.name] = role.id;
  }

  // Admin user
  const user = await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      name: input.adminName,
      email: input.email,
      phone: input.phone,
      passwordHash: hashPassword(input.password),
      roleId: roleIds["Workspace Admin"],
      status: "active",
    },
  });

  // Chart of accounts
  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
      workspaceId: workspace.id,
      code: a.code,
      name: a.name,
      type: a.type,
      status: "active",
      isSystem: true,
    })),
  });

  // Leave types
  await prisma.leaveType.createMany({
    data: DEFAULT_LEAVE_TYPES.map((lt) => ({ workspaceId: workspace.id, ...lt })),
  });

  // Trial subscription
  const now = new Date();
  await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      plan: input.plan ?? "Starter",
      status: "trial",
      billingPeriod: "monthly",
      price: 0,
      employeeLimit: 15,
      startDate: now,
      renewalDate: new Date(now.getTime() + 14 * 86400000),
    },
  });

  // Default bank accounts
  await prisma.bankAccount.createMany({
    data: [
      { workspaceId: workspace.id, name: "Business Checking", bank: "Primary Bank", accountNumber: "****0001", currency: input.currency ?? "USD", openingBalance: 0, currentBalance: 0 },
      { workspaceId: workspace.id, name: "Cash on Hand", bank: "Petty Cash", accountNumber: "CASH", currency: input.currency ?? "USD", openingBalance: 0, currentBalance: 0 },
    ],
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "create",
      module: "workspace",
      description: `Workspace ${workspace.name} registered`,
    },
  });

  return { workspace, user };
}