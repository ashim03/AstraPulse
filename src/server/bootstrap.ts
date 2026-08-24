import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_LEAVE_TYPES } from "@/lib/constants";
import { ROLE_DEFAULTS } from "@/lib/permissions";

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
      currency: input.currency ?? "NPR",
      timezone: input.timezone ?? "America/New_York",
      businessType: input.businessType,
      status: "active",
    },
  });

  // System roles – use granular ROLE_DEFAULTS from permissions module
  const roleDescriptions: Record<string, string> = {
    "Workspace Admin": "Manage workspace, staff, approvals and subscriptions.",
    "HR Manager": "Manage employees, attendance, leave and documents.",
    "HR Staff": "HR support: staff records, attendance and leave.",
    "Finance Manager": "Manage accounting, expenses, income, invoices and reports.",
    "Payroll Staff": "Process payroll and view payroll reports.",
    "Manager": "Approve leave and work records for their team.",
    "Employee": "Self-service: attendance, leave requests and timesheets.",
  };
  const roleIds: Record<string, string> = {};

  // Super Admin always gets full access
  const superAdmin = await prisma.role.create({
    data: {
      workspaceId: workspace.id,
      name: "Super Admin",
      description: "Full access to everything including billing and system settings.",
      isSystem: true,
      permissions: JSON.stringify(["*"]),
    },
  });
  roleIds["Super Admin"] = superAdmin.id;

  for (const [roleName, perms] of Object.entries(ROLE_DEFAULTS)) {
    const expanded = perms.flatMap((p: string) => {
      const [mod, action] = p.split(":");
      if (action === "*") {
        return ["view", "create", "edit", "delete", "approve", "export", "manage", "settings", "reports", "preview", "periods", "auth", "assign", "employee_dashboard", "view_sensitive", "device", "export"].map((a) => `${mod}:${a}`);
      }
      return [p];
    });
    const role = await prisma.role.create({
      data: {
        workspaceId: workspace.id,
        name: roleName,
        description: roleDescriptions[roleName] ?? "",
        isSystem: true,
        permissions: JSON.stringify(expanded),
      },
    });
    roleIds[roleName] = role.id;
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
      emailVerified: true,
      emailVerifiedAt: new Date(),
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

  // 7-day trial subscription
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 86400000);
  await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      planName: input.plan ?? "starter",
      status: "active",
      billingPeriod: "monthly",
      price: 0,
      employeeLimit: 15,
      userLimit: 50,
      isTrial: true,
      trialEndDate: trialEnd,
      paymentStatus: "unpaid",
      startDate: now,
      renewalDate: trialEnd,
    },
  });

  // Default bank accounts
  await prisma.bankAccount.createMany({
    data: [
      { workspaceId: workspace.id, name: "Business Checking", bank: "Primary Bank", accountNumber: "****0001", currency: input.currency ?? "NPR", openingBalance: 0, currentBalance: 0 },
      { workspaceId: workspace.id, name: "Cash on Hand", bank: "Petty Cash", accountNumber: "CASH", currency: input.currency ?? "NPR", openingBalance: 0, currentBalance: 0 },
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