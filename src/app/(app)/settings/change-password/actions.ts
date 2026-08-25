"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fail, ok, writeAudit, type ActionResult } from "@/lib/actions";
import { validatePassword } from "@/services/password";

import { sendPasswordChangeConfirmation } from "@/services/brevo";
import { logAuthEvent } from "@/services/auth-audit";
import bcrypt from "bcryptjs";

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    return fail("Not authenticated");
  }

  if (!currentPassword || !newPassword) {
    return fail("Current password and new password are required");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, passwordHash: true, workspaceId: true, email: true, name: true },
  });

  if (!user) {
    return fail("User not found");
  }

  const validCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validCurrent) {
    await logAuthEvent({
      workspaceId: session.workspaceId,
      userId: session.id,
      email: session.email,
      action: "change_password",
      success: false,
      metadata: { reason: "invalid_current_password" },
    });
    return fail("Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    return fail("New password must be different from current password");
  }

  const settings = await prisma.authSettings.findFirst({
    where: { workspaceId: session.workspaceId },
  });
  const validation = validatePassword(newPassword, {
    minLength: settings?.passwordMinLength ?? 8,
    requireUppercase: settings?.passwordRequireUppercase ?? true,
    requireLowercase: settings?.passwordRequireLowercase ?? true,
    requireNumber: settings?.passwordRequireNumber ?? true,
    requireSpecial: settings?.passwordRequireSpecial ?? true,
  });

  if (!validation.valid) {
    return fail(validation.errors[0] ?? "Password does not meet requirements");
  }

  const newHash = bcrypt.hashSync(newPassword, 10);

  await prisma.user.update({
    where: { id: session.id },
    data: {
      passwordHash: newHash,
      lastPasswordChange: new Date(),
    },
  });

  if (settings?.forceLogoutOnPasswordChange) {
    await prisma.user.update({
      where: { id: session.id },
      data: {
        twoFactorSecret: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  await sendPasswordChangeConfirmation(session.workspaceId, session.email, session.name).catch(() => {});

  await logAuthEvent({
    workspaceId: session.workspaceId,
    userId: session.id,
    email: session.email,
    action: "change_password",
    success: true,
  });

  await writeAudit({
    session,
    action: "update",
    module: "auth",
    description: `${session.name} changed their password`,
  });

  return ok(undefined, "Password changed successfully");
}
