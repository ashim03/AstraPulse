import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getBrevoConfig } from "@/services/brevo";

export type OtpType = "registration" | "login" | "password_reset" | "email_verify";

function generateCode(length: number): string {
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join("");
}

export async function getAuthSettings(workspaceId: string) {
  const settings = await prisma.authSettings.findUnique({ where: { workspaceId } });
  if (settings) return settings;
  return prisma.authSettings.create({ data: { workspaceId } });
}

export async function createOtp(
  workspaceId: string,
  email: string,
  type: OtpType,
  userId?: string
): Promise<{ code: string; expiresAt: Date }> {
  const settings = await getAuthSettings(workspaceId);
  const code = generateCode(settings.otpLength);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + settings.otpExpirationMinutes * 60 * 1000);

  await prisma.otpVerification.create({
    data: {
      workspaceId,
      userId: userId ?? null,
      email: email.toLowerCase().trim(),
      codeHash,
      type,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function verifyOtp(
  workspaceId: string,
  email: string,
  code: string,
  type: OtpType
): Promise<{ valid: boolean; remainingAttempts: number; error?: string }> {
  const settings = await getAuthSettings(workspaceId);
  const record = await prisma.otpVerification.findFirst({
    where: {
      workspaceId,
      email: email.toLowerCase().trim(),
      type,
      verified: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { valid: false, remainingAttempts: 0, error: "No verification code found. Please request a new one." };
  }

  if (record.expiresAt < new Date()) {
    return { valid: false, remainingAttempts: 0, error: "This code has expired. Please request a new one." };
  }

  if (record.attempts >= settings.maxOtpAttempts) {
    return { valid: false, remainingAttempts: 0, error: "Too many failed attempts. Please request a new code." };
  }

  const match = await bcrypt.compare(code, record.codeHash);
  if (!match) {
    const newAttempts = record.attempts + 1;
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: newAttempts },
    });
    return {
      valid: false,
      remainingAttempts: settings.maxOtpAttempts - newAttempts,
      error: `Invalid code. ${settings.maxOtpAttempts - newAttempts} attempt(s) remaining.`,
    };
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verified: true },
  });

  return { valid: true, remainingAttempts: settings.maxOtpAttempts - record.attempts };
}

export async function checkResendCooldown(
  workspaceId: string,
  email: string,
  type: OtpType
): Promise<{ canResend: boolean; waitSeconds: number }> {
  const settings = await getAuthSettings(workspaceId);
  const lastOtp = await prisma.otpVerification.findFirst({
    where: {
      workspaceId,
      email: email.toLowerCase().trim(),
      type,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastOtp) return { canResend: true, waitSeconds: 0 };

  const elapsed = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
  if (elapsed >= settings.otpResendCooldownSeconds) {
    return { canResend: true, waitSeconds: 0 };
  }

  return {
    canResend: false,
    waitSeconds: Math.ceil(settings.otpResendCooldownSeconds - elapsed),
  };
}

export async function sendOtpForType(
  workspaceId: string,
  email: string,
  name: string,
  type: OtpType,
  userId?: string
): Promise<{ success: boolean; error?: string; cooldown?: number }> {
  const cooldown = await checkResendCooldown(workspaceId, email, type);
  if (!cooldown.canResend) {
    return { success: false, error: "Please wait before requesting another code", cooldown: cooldown.waitSeconds };
  }

  const settings = await getAuthSettings(workspaceId);
  const resendCount = await prisma.otpVerification.count({
    where: {
      workspaceId,
      email: email.toLowerCase().trim(),
      type,
      createdAt: { gte: new Date(Date.now() - settings.otpExpirationMinutes * 60 * 1000) },
    },
  });

  if (resendCount >= settings.maxOtpResends) {
    return { success: false, error: "Maximum resend limit reached. Please try again later." };
  }

  const { code } = await createOtp(workspaceId, email, type, userId);

  const { sendOtpEmail } = await import("@/services/brevo");
  const result = await sendOtpEmail(workspaceId, email, name, code, type as "registration" | "login" | "password_reset");

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
