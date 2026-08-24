"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSession,
  getSession,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/auth";
import { bootstrapWorkspace } from "@/server/bootstrap";
import { fail, ok, writeAudit, type ActionResult } from "@/lib/actions";
import { parsePermissions } from "@/lib/permissions";
import { sendPasswordChangeConfirmation } from "@/services/brevo";
import { isAccountLocked, recordFailedLogin, resetFailedLogins } from "@/services/password";
import { logAuthEvent } from "@/services/auth-audit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  code: z.string().optional(),
});

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<{ need2fa: boolean; userId?: string; accountType?: string }>> {
  const parsed = loginSchema.pick({ email: true, password: true }).safeParse(input);
  if (!parsed.success) {
    return fail("Please check your details", Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    include: { workspace: true, role: true, employee: true },
  });

  if (!user || user.status === "inactive") {
    return fail("Invalid email or password");
  }

  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.locked) {
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "login",
      success: false,
      metadata: { reason: "account_locked" },
    });
    return fail("Account is temporarily locked due to too many failed attempts. Please try again later.");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const authSettings = await prisma.authSettings.findFirst({
      where: { workspaceId: user.workspaceId },
    });
    const lockResult = await recordFailedLogin(
      user.id,
      authSettings?.maxFailedLoginAttempts ?? 5,
      authSettings?.lockoutDurationMinutes ?? 15
    );
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "login",
      success: false,
      metadata: { reason: "invalid_password", remainingAttempts: lockResult.remainingAttempts },
    });
    if (lockResult.locked) {
      return fail("Account has been locked due to too many failed attempts. Please try again later.");
    }
    return fail("Invalid email or password");
  }

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "login",
    success: true,
  });

  if (user.twoFactorEnabled) {
    await writeAudit({
      session: {
        id: user.id,
        workspaceId: user.workspaceId,
        name: user.name,
        email: user.email,
        role: user.role?.name ?? "",
        rolePermissions: parsePermissions(user.role?.permissions ?? "[]"),
        accountType: user.accountType ?? "organization",
        employeeId: user.employeeId ?? null,
      },
      action: "login",
      module: "auth",
      description: `${user.name} signed in (2FA pending)`,
    });
    return ok({ need2fa: true, userId: user.id });
  }

  await resetFailedLogins(user.id);

  await setSessionCookie({
    id: user.id,
    workspaceId: user.workspaceId,
    name: user.name,
    email: user.email,
    role: user.role?.name ?? "Employee",
    rolePermissions: parsePermissions(user.role?.permissions ?? "[]"),
    accountType: user.accountType ?? "organization",
    employeeId: user.employeeId ?? null,
    departmentId: user.employee?.departmentId ?? null,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await writeAudit({
    session: {
      id: user.id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? "",
      rolePermissions: parsePermissions(user.role?.permissions ?? "[]"),
      accountType: user.accountType ?? "organization",
      employeeId: user.employeeId ?? null,
    },
    action: "login",
    module: "auth",
    description: `${user.name} signed in`,
  });

  const acctType = user.accountType ?? "organization";
  redirect(acctType === "super_admin" ? "/super-admin" : "/");
}

export async function verifyTwoFactorAction(userId: string, code: string): Promise<ActionResult<{ accountType: string }>> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, employee: true } });
  if (!user?.twoFactorSecret) return fail("Two-factor is not enabled for this account");
  if (!verifyTotp(user.twoFactorSecret, code)) return fail("Invalid verification code");

  await setSessionCookie({
    id: user.id,
    workspaceId: user.workspaceId,
    name: user.name,
    email: user.email,
    role: user.role?.name ?? "Employee",
    rolePermissions: parsePermissions(user.role?.permissions ?? "[]"),
    accountType: user.accountType ?? "organization",
    employeeId: user.employeeId ?? null,
    departmentId: user.employee?.departmentId ?? null,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const acctType = user.accountType ?? "organization";
  redirect(acctType === "super_admin" ? "/super-admin" : "/");
}

const registerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  email: z.string().email("Enter a valid email"),
  adminName: z.string().min(2, "Admin name is required"),
  phone: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  businessType: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(input: z.infer<typeof registerSchema>): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields", Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
  }

  const existing = await prisma.user.findFirst({ where: { email: parsed.data.email.toLowerCase().trim() } });
  if (existing) return fail("An account with this email already exists");

  const { workspace, user } = await bootstrapWorkspace({
    companyName: parsed.data.companyName.trim(),
    email: parsed.data.email.toLowerCase().trim(),
    adminName: parsed.data.adminName.trim(),
    phone: parsed.data.phone,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
    businessType: parsed.data.businessType,
    password: parsed.data.password,
  });

  await logAuthEvent({
    workspaceId: workspace.id,
    userId: user.id,
    email: user.email,
    action: "register",
    success: true,
  });

  await setSessionCookie({
    id: user.id,
    workspaceId: workspace.id,
    name: user.name,
    email: user.email,
    role: "Workspace Admin",
    rolePermissions: [],
    accountType: "organization",
    employeeId: null,
    departmentId: null,
  });

  redirect("/");
}

export async function logoutAction() {
  "use server";
  const session = await getSession();
  if (session) {
    await writeAudit({ session, action: "logout", module: "auth", description: `${session.name} signed out` });
  }
  await clearSession();
  return { ok: true };
}

export async function forgotPasswordAction(email: string): Promise<ActionResult> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return fail("Enter a valid email");
  const user = await prisma.user.findFirst({ where: { email: parsed.data.toLowerCase().trim() } });
  if (!user) return ok(undefined, "If an account exists, a reset link has been sent.");

  const token = generateTotpSecret().replace(/[-_]/g, "");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: token, lastPasswordChange: expiresAt },
  });

  await writeAudit({
    session: {
      id: user.id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: "Employee",
      rolePermissions: [],
      accountType: user.accountType ?? "organization",
      employeeId: null,
    },
    action: "forgot_password",
    module: "auth",
    description: `Password reset requested for ${user.email}`,
  });

  return ok(undefined, "If an account exists, a reset link has been sent.");
}

export async function resetPasswordAction(token: string, newPassword: string): Promise<ActionResult> {
  const parsed = z.string().min(8).safeParse(newPassword);
  if (!parsed.success) return fail("Password must be at least 8 characters");

  const user = await prisma.user.findFirst({
    where: { twoFactorSecret: token },
  });

  if (!user || !user.lastPasswordChange || user.lastPasswordChange < new Date()) {
    return fail("Invalid or expired reset link");
  }

  const hashed = await hashPassword(parsed.data);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashed,
      twoFactorSecret: null,
      lastPasswordChange: null,
      failedLoginAttempts: 0,
    },
  });

  await sendPasswordChangeConfirmation(user.workspaceId, user.email, user.name);

  await writeAudit({
    session: {
      id: user.id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: "Employee",
      rolePermissions: [],
      accountType: user.accountType ?? "organization",
      employeeId: null,
    },
    action: "reset_password",
    module: "auth",
    description: `Password reset completed for ${user.email}`,
  });

  return ok(undefined, "Password reset successful. You can now log in.");
}

export async function enableTwoFactorAction(enabled: boolean): Promise<ActionResult<{ secret?: string; uri?: string }>> {
  const session = await getSession();
  if (!session) return fail("Not authenticated");

  if (enabled) {
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: session.id },
      data: { twoFactorSecret: secret },
    });
    return ok({ secret });
  } else {
    await prisma.user.update({
      where: { id: session.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return ok(undefined, "Two-factor authentication disabled");
  }
}

export async function confirmTwoFactorAction(code: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail("Not authenticated");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.twoFactorSecret) return fail("Two-factor setup not initiated");

  if (!verifyTotp(user.twoFactorSecret, code)) return fail("Invalid code. Please try again.");

  await prisma.user.update({
    where: { id: session.id },
    data: { twoFactorEnabled: true },
  });

  return ok(undefined, "Two-factor authentication enabled");
}
