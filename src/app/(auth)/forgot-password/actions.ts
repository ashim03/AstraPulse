"use server";

import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { createOtp, verifyOtp, sendOtpForType } from "@/services/otp";
import { hashPassword, validatePassword, createPasswordResetToken, invalidatePasswordResets } from "@/services/password";
import { logAuthEvent } from "@/services/auth-audit";
import { sendPasswordChangeConfirmation } from "@/services/brevo";

export async function forgotPasswordSendOtpAction(
  email: string
): Promise<ActionResult<{ waitSeconds?: number }>> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, name: true },
  });

  if (!user) {
    return ok(undefined, "If an account exists with this email, we have sent a verification code.");
  }

  const result = await sendOtpForType(
    user.workspaceId,
    email,
    user.name,
    "password_reset",
    user.id
  );

  if (!result.success) {
    return fail(result.error ?? "Failed to send code", { waitSeconds: String(result.cooldown ?? 60) });
  }

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "forgot_password",
    success: true,
    metadata: { type: "send_otp" },
  });

  return ok(undefined, "If an account exists with this email, we have sent a verification code.");
}

export async function verifyForgotPasswordOtpAction(
  email: string,
  code: string
): Promise<ActionResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, name: true },
  });

  if (!user) {
    return fail("Invalid or expired code");
  }

  const result = await verifyOtp(user.workspaceId, email, code, "password_reset");

  if (!result.valid) {
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "forgot_password",
      success: false,
      metadata: { reason: "invalid_otp" },
    });
    return fail(result.error ?? "Invalid code");
  }

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "forgot_password",
    success: true,
    metadata: { type: "otp_verified" },
  });

  return ok(undefined, "Code verified");
}

export async function resetPasswordWithOtpAction(
  email: string,
  code: string,
  newPassword: string
): Promise<ActionResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, name: true, passwordHash: true },
  });

  if (!user) {
    return fail("Invalid or expired code");
  }

  const verifyResult = await verifyOtp(user.workspaceId, email, code, "password_reset");
  if (!verifyResult.valid) {
    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "reset_password",
      success: false,
      metadata: { reason: "invalid_otp" },
    });
    return fail(verifyResult.error ?? "Invalid code");
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
      lastPasswordChange: new Date(),
    },
  });

  await invalidatePasswordResets(user.id);

  await sendPasswordChangeConfirmation(user.workspaceId, email, user.name).catch(() => {});

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "reset_password",
    success: true,
  });

  return ok(undefined, "Password reset successful! You can now log in.");
}
