"use server";

import { z } from "zod";
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
import { createOtp, verifyOtp, sendOtpForType, getAuthSettings } from "@/services/otp";
import { sendOtpEmail, sendPasswordChangeConfirmation } from "@/services/brevo";
import { isAccountLocked, recordFailedLogin, resetFailedLogins } from "@/services/password";
import { logAuthEvent } from "@/services/auth-audit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  code: z.string().optional(),
});

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<{ need2fa: boolean; userId?: string; accountType?: string; requiresOtp?: boolean; email?: string }>> {
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

  if (user.status === "pending") {
    return fail("Please verify your email before signing in");
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
    const authSettings = await getAuthSettings(user.workspaceId);
    const lockResult = await recordFailedLogin(
      user.id,
      authSettings.maxFailedLoginAttempts,
      authSettings.lockoutDurationMinutes
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

  const authSettings = await getAuthSettings(user.workspaceId);
  if (authSettings.loginOtpEnabled) {
    const otpResult = await sendOtpForType(
      user.workspaceId,
      email,
      user.name,
      "login",
      user.id
    );

    if (otpResult.success) {
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
        description: `${user.name} signed in (OTP sent)`,
      });
      return ok({ requiresOtp: true, email, need2fa: false });
    }
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

  return ok({ need2fa: false, accountType: user.accountType ?? "organization" }, "Welcome back!");
}

export async function verifyTwoFactorAction(userId: string, code: string): Promise<ActionResult<{ accountType: string }>> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
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
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return ok({ accountType: user.accountType ?? "organization" }, "Authenticated");
}

export async function verifyLoginOtpAction(
  email: string,
  code: string
): Promise<ActionResult<{ accountType?: string }>> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    include: { role: true },
  });

  if (!user) {
    return fail("Invalid code");
  }

  const result = await verifyOtp(user.workspaceId, email, code, "login");

  if (!result.valid) {
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "login_otp",
      success: false,
      metadata: { remainingAttempts: result.remainingAttempts },
    });
    return fail(result.error ?? "Invalid code");
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
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "login_otp",
    success: true,
  });

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
    description: `${user.name} signed in (OTP verified)`,
  });

  return ok({ accountType: user.accountType ?? "organization" }, "Authenticated");
}

export async function resendLoginOtpAction(
  email: string
): Promise<ActionResult<{ waitSeconds?: number }>> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, name: true },
  });

  if (!user) {
    return fail("User not found");
  }

  const result = await sendOtpForType(
    user.workspaceId,
    email,
    user.name,
    "login",
    user.id
  );

  if (!result.success) {
    return fail(result.error ?? "Failed to resend code", { waitSeconds: String(result.cooldown ?? 60) });
  }

  return ok(undefined, "Code resent");
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

export async function registerAction(input: z.infer<typeof registerSchema>): Promise<ActionResult<{ requiresVerification?: boolean; email?: string }>> {
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

  const authSettings = await getAuthSettings(workspace.id);
  if (authSettings.emailVerificationRequired) {
    const otpResult = await sendOtpForType(
      workspace.id,
      user.email,
      user.name,
      "email_verify",
      user.id
    );

    if (otpResult.success) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "pending" },
      });

      return ok({ requiresVerification: true, email: user.email }, "Please verify your email to continue.");
    }
  }

  await setSessionCookie({
    id: user.id,
    workspaceId: workspace.id,
    name: user.name,
    email: user.email,
    role: "Workspace Admin",
    rolePermissions: [],
    accountType: "organization",
    employeeId: null,
  });

  return ok(undefined, `Welcome to AstraPulse, ${user.name.split(" ")[0]}! Your workspace is ready.`);
}

export async function verifyRegistrationAction(
  email: string,
  code: string
): Promise<ActionResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    include: { role: true },
  });

  if (!user) {
    return fail("User not found");
  }

  const result = await verifyOtp(user.workspaceId, email, code, "email_verify");

  if (!result.valid) {
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "verify_email",
      success: false,
      metadata: { source: "registration", remainingAttempts: result.remainingAttempts },
    });
    return fail(result.error ?? "Invalid code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "active",
    },
  });

  await setSessionCookie({
    id: user.id,
    workspaceId: user.workspaceId,
    name: user.name,
    email: user.email,
    role: user.role?.name ?? "Workspace Admin",
    rolePermissions: parsePermissions(user.role?.permissions ?? "[]"),
    accountType: user.accountType ?? "organization",
    employeeId: user.employeeId ?? null,
  });

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "verify_email",
    success: true,
    metadata: { source: "registration" },
  });

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
    action: "register",
    module: "auth",
    description: `${user.name} verified email and registered`,
  });

  return ok(undefined, "Email verified! Welcome to AstraPulse.");
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
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: null },
  });
  // Store reset token (demo: reuse twoFactorSecret slot with a prefix)
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: `reset:${token}` },
  });
  return ok(undefined, `Reset token (demo): ${token}`);
}

export async function resetPasswordAction(token: string, password: string): Promise<ActionResult> {
  const parsed = z.string().min(8).safeParse(password);
  if (!parsed.success) return fail("Password must be at least 8 characters");

  const users = await prisma.user.findMany({ where: { twoFactorSecret: { startsWith: "reset:" } } });
  const user = users.find((u) => (u.twoFactorSecret ?? "").split(":")[1] === token);
  if (!user) return fail("Invalid or expired reset token");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password), twoFactorSecret: null },
  });
  return ok(undefined, "Password updated. You can now sign in.");
}

export async function enableTwoFactorAction(enabled: boolean): Promise<ActionResult<{ secret: string }>> {
  const session = await getSession();
  if (!session) return fail("Not authenticated");
  if (enabled) {
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: session.id }, data: { twoFactorSecret: secret, twoFactorEnabled: true } });
    return ok({ secret });
  }
  await prisma.user.update({ where: { id: session.id }, data: { twoFactorSecret: null, twoFactorEnabled: false } });
  return ok(undefined, "Two-factor authentication disabled");
}
