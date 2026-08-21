"use server";

import { redirect } from "next/navigation";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  code: z.string().optional(),
});

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<{ need2fa: boolean; userId?: string }>> {
  const parsed = loginSchema.pick({ email: true, password: true }).safeParse(input);
  if (!parsed.success) {
    return fail("Please check your details", Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), status: "active" },
    include: { workspace: true, role: true, employee: true },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail("Invalid email or password");
  }

  await writeAudit({
    session: {
      id: user.id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? "",
      employeeId: user.employeeId ?? null,
    },
    action: "login",
    module: "auth",
    description: `${user.name} signed in`,
  });

  if (user.twoFactorEnabled) {
    return ok({ need2fa: true, userId: user.id });
  }

  await setSessionCookie({
    id: user.id,
    workspaceId: user.workspaceId,
    name: user.name,
    email: user.email,
    role: user.role?.name ?? "Employee",
    employeeId: user.employeeId ?? null,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return ok(undefined, "Welcome back!");
}

export async function verifyTwoFactorAction(userId: string, code: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user?.twoFactorSecret) return fail("Two-factor is not enabled for this account");
  if (!verifyTotp(user.twoFactorSecret, code)) return fail("Invalid verification code");

  await setSessionCookie({
    id: user.id,
    workspaceId: user.workspaceId,
    name: user.name,
    email: user.email,
    role: user.role?.name ?? "Employee",
    employeeId: user.employeeId ?? null,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return ok(undefined, "Authenticated");
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

  await setSessionCookie({
    id: user.id,
    workspaceId: workspace.id,
    name: user.name,
    email: user.email,
    role: "Workspace Admin",
    employeeId: null,
  });

  return ok(undefined, `Welcome to AstraPulse, ${user.name.split(" ")[0]}! Your workspace is ready.`);
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await writeAudit({ session, action: "logout", module: "auth", description: `${session.name} signed out` });
  }
  await clearSession();
  redirect("/login");
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