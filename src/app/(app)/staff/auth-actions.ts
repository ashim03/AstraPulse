"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { writeAudit, notify, ok, fail, type ActionResult } from "@/lib/actions";

async function requirePerm(module: string, action: string = "edit") {
  const session = await requireSession();
  if (!hasPermission(session, module, action as never)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

async function logAuthEvent(params: {
  workspaceId: string;
  userId?: string | null;
  email: string;
  action: string;
  success: boolean;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.authAuditLog.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId ?? null,
        email: params.email,
        action: params.action,
        success: params.success,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch {
    // audit logging should never break the flow
  }
}



export async function toggleAccountStatusAction(userId: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, workspaceId: session.workspaceId },
    });
    if (!user) return fail("User not found");

    await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    await logAuthEvent({
      workspaceId: session.workspaceId,
      userId: user.id,
      email: user.email,
      action: "admin_disable",
      success: true,
      metadata: { newStatus: status },
    });

    await writeAudit({
      session,
      action: "edit",
      module: "staff",
      recordId: user.id,
      description: "Changed account status of " + user.email + " to " + status,
    });

    revalidatePath("/staff");
    return ok(undefined, "Account " + (status === "active" ? "enabled" : "disabled"));
  } catch (e) {
    return fail("Failed to toggle status: " + (e as Error).message);
  }
}

export async function forcePasswordResetAction(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, workspaceId: session.workspaceId },
    });
    if (!user) return fail("User not found");

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashPassword(token);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        workspaceId: session.workspaceId,
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const emailConfig = await prisma.emailConfig.findUnique({
      where: { workspaceId: session.workspaceId },
    });
    if (emailConfig?.isEnabled && emailConfig.apiKey) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": emailConfig.apiKey,
        },
        body: JSON.stringify({
          sender: { name: emailConfig.senderName, email: emailConfig.senderEmail },
          to: [{ email: user.email }],
          subject: "AstraPulse - Password Reset Required",
          htmlContent: "<html><body><h2>Password Reset Required</h2><p>An administrator has requested a password reset for your account.</p><p>Please use the following token to reset your password: <strong>" + token + "</strong></p><p>This token expires in 1 hour.</p></body></html>",
        }),
      }).catch(() => {});
    }

    await logAuthEvent({
      workspaceId: session.workspaceId,
      userId: user.id,
      email: user.email,
      action: "admin_force_reset",
      success: true,
    });

    await writeAudit({
      session,
      action: "edit",
      module: "staff",
      recordId: user.id,
      description: "Forced password reset for " + user.email,
    });

    revalidatePath("/staff");
    return ok(undefined, "Password reset email sent");
  } catch (e) {
    return fail("Failed to force password reset: " + (e as Error).message);
  }
}

export async function forceLogoutAction(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, workspaceId: session.workspaceId },
    });
    if (!user) return fail("User not found");

    await prisma.user.update({
      where: { id: userId },
      data: { lastPasswordChange: new Date() },
    });

    await logAuthEvent({
      workspaceId: session.workspaceId,
      userId: user.id,
      email: user.email,
      action: "admin_disable",
      success: true,
      metadata: { action: "force_logout" },
    });

    await writeAudit({
      session,
      action: "edit",
      module: "staff",
      recordId: user.id,
      description: "Force logged out " + user.email,
    });

    revalidatePath("/staff");
    return ok(undefined, "User logged out");
  } catch (e) {
    return fail("Failed to force logout: " + (e as Error).message);
  }
}

export async function resetAuthSettingsAction(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requirePerm("staff", "edit");
  } catch {
    return fail("You don't have permission");
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, workspaceId: session.workspaceId },
    });
    if (!user) return fail("User not found");

    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await logAuthEvent({
      workspaceId: session.workspaceId,
      userId: user.id,
      email: user.email,
      action: "admin_force_reset",
      success: true,
      metadata: { action: "reset_auth_settings" },
    });

    await writeAudit({
      session,
      action: "edit",
      module: "staff",
      recordId: user.id,
      description: "Reset auth settings for " + user.email + ": unlocked account",
    });

    revalidatePath("/staff");
    return ok(undefined, "Auth settings reset");
  } catch (e) {
    return fail("Failed to reset auth settings: " + (e as Error).message);
  }
}
