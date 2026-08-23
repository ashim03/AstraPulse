"use server";

import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { verifyOtp, sendOtpForType } from "@/services/otp";
import { logAuthEvent } from "@/services/auth-audit";

export async function verifyEmailAction(
  email: string,
  code: string
): Promise<ActionResult<{ remainingAttempts?: number }>> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, workspaceId: true, email: true, name: true },
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
      metadata: { reason: "invalid_code", remainingAttempts: result.remainingAttempts },
    });
    return fail(result.error ?? "Invalid code", undefined);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "active",
    },
  });

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "verify_email",
    success: true,
  });

  return ok(undefined, "Email verified successfully");
}

export async function resendVerificationAction(
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
    "email_verify",
    user.id
  );

  if (!result.success) {
    return fail(result.error ?? "Failed to resend code", { waitSeconds: String(result.cooldown ?? 60) });
  }

  await logAuthEvent({
    workspaceId: user.workspaceId,
    userId: user.id,
    email,
    action: "verify_email",
    success: true,
    metadata: { type: "resend" },
  });

  return ok(undefined, "Verification code sent");
}
