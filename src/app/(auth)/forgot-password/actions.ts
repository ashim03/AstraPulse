"use server";

import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { hashPassword, validatePassword } from "@/services/password";
import { logAuthEvent } from "@/services/auth-audit";
import { sendPasswordChangeConfirmation } from "@/services/brevo";
import crypto from "crypto";

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function forgotPasswordSendTokenAction(
  email: string
): Promise<ActionResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, name: true },
  });

  if (!user) {
    return ok(undefined, "If an account exists with this email, a password reset code has been sent.");
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: token, lastPasswordChange: expiresAt },
  });

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "forgot_password",
    success: true,
    metadata: { type: "token_generated" },
  });

  return ok(undefined, "If an account exists with this email, a password reset code has been sent.");
}

export async function verifyResetTokenAction(
  token: string
): Promise<ActionResult> {
  if (!token || token.length < 10) {
    return fail("Invalid reset code");
  }

  const user = await prisma.user.findFirst({
    where: {
      twoFactorSecret: token,
      lastPasswordChange: { gt: new Date() },
    },
    select: { id: true, workspaceId: true, email: true },
  });

  if (!user) {
    return fail("Invalid or expired reset code");
  }

  return ok(undefined, "Code verified. You can now set a new password.");
}

export async function resetPasswordWithTokenAction(
  token: string,
  newPassword: string
): Promise<ActionResult> {
  if (!token || token.length < 10) {
    return fail("Invalid reset code");
  }

  const user = await prisma.user.findFirst({
    where: {
      twoFactorSecret: token,
      lastPasswordChange: { gt: new Date() },
    },
    select: { id: true, workspaceId: true, email: true, name: true, passwordHash: true },
  });

  if (!user) {
    return fail("Invalid or expired reset code");
  }

  const settings = await prisma.authSettings.findUnique({ where: { workspaceId: user.workspaceId } });
  const passwordValidation = validatePassword(newPassword, {
    minLength: settings?.passwordMinLength ?? 8,
    requireUppercase: settings?.passwordRequireUppercase ?? true,
    requireLowercase: settings?.passwordRequireLowercase ?? true,
    requireNumber: settings?.passwordRequireNumber ?? true,
    requireSpecial: settings?.passwordRequireSpecial ?? true,
  });

  if (!passwordValidation.valid) {
    return fail(passwordValidation.errors[0] ?? "Password does not meet requirements");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      twoFactorSecret: null,
      lastPasswordChange: null,
      failedLoginAttempts: 0,
    },
  });

  await sendPasswordChangeConfirmation(user.workspaceId, user.email, user.name);

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email: user.email,
    action: "reset_password",
    success: true,
  });

  return ok(undefined, "Password reset successful. You can now log in.");
}
