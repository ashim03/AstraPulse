import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(
  password: string,
  settings: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < settings.minLength) {
    errors.push(`Password must be at least ${settings.minLength} characters`);
  }
  if (settings.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (settings.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (settings.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (settings.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return { valid: errors.length === 0, errors };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: "weak" | "fair" | "good" | "strong";
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 5;
  if (password.length < 8) feedback.push("Use a longer password");

  if (/[a-z]/.test(password)) score += 10;
  else feedback.push("Add lowercase letters");

  if (/[A-Z]/.test(password)) score += 10;
  else feedback.push("Add uppercase letters");

  if (/[0-9]/.test(password)) score += 10;
  else feedback.push("Add numbers");

  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  else feedback.push("Add special characters");

  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 2, 10);

  const repeating = /(.)\1{2,}/.test(password);
  if (repeating) {
    score -= 10;
    feedback.push("Avoid repeating characters");
  }

  const sequential = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
    password
  );
  if (sequential) {
    score -= 10;
    feedback.push("Avoid sequential characters");
  }

  const common = /^(password|123456|qwerty|letmein|admin|welcome|monkey|dragon)/i.test(
    password
  );
  if (common) {
    score -= 20;
    feedback.push("Avoid common passwords");
  }

  score = Math.max(0, Math.min(100, score));

  let label: "weak" | "fair" | "good" | "strong";
  if (score < 30) label = "weak";
  else if (score < 50) label = "fair";
  else if (score < 70) label = "good";
  else label = "strong";

  return {
    score,
    label,
    feedback:
      feedback.length > 0 ? feedback.join(". ") : "Password looks strong",
  };
}

export async function createPasswordResetToken(
  workspaceId: string,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      workspaceId,
      userId,
      tokenHash,
      expiresAt,
      used: false,
    },
  });

  return { token, expiresAt };
}

export async function verifyPasswordResetToken(
  workspaceId: string,
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      workspaceId,
      tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { valid: false };
  }

  return { valid: true, userId: record.userId };
}

export async function invalidatePasswordResets(userId: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });
}

export async function isAccountLocked(
  userId: string
): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });

  if (!user || !user.lockedUntil) {
    return { locked: false };
  }

  if (new Date() < user.lockedUntil) {
    return { locked: true, lockedUntil: user.lockedUntil };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lockedUntil: null, failedLoginAttempts: 0 },
  });

  return { locked: false };
}

export async function recordFailedLogin(
  userId: string,
  maxAttempts: number,
  lockoutMinutes: number
): Promise<{ locked: boolean; remainingAttempts: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });

  if (!user) return { locked: false, remainingAttempts: maxAttempts };

  const newCount = user.failedLoginAttempts + 1;
  const data: Record<string, unknown> = { failedLoginAttempts: newCount };
  let locked = false;

  if (newCount >= maxAttempts) {
    data.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    locked = true;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });

  return { locked, remainingAttempts: Math.max(0, maxAttempts - newCount) };
}

export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
