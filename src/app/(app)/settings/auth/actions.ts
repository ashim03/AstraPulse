"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

async function requirePerm(module: string, action: string = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action as never)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getAuthSettingsAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("settings", "view");
    let settings = await prisma.authSettings.findUnique({
      where: { workspaceId: session.workspaceId },
    });
    if (!settings) {
      settings = await prisma.authSettings.create({
        data: { workspaceId: session.workspaceId },
      });
    }
    return ok(settings);
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to load auth settings");
  }
}

export async function updateAuthSettingsAction(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const session = await requirePerm("settings", "edit");
    const settings = await prisma.authSettings.upsert({
      where: { workspaceId: session.workspaceId },
      create: { workspaceId: session.workspaceId, ...sanitizeAuthData(data) },
      update: sanitizeAuthData(data),
    });
    await writeAudit({
      session,
      action: "edit",
      module: "settings",
      recordId: settings.id,
      description: "Updated authentication settings",
      before: null,
      after: settings,
    });
    revalidatePath("/settings/auth");
    return ok(settings, "Auth settings saved");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to save auth settings: " + (e as Error).message);
  }
}

export async function getEmailConfigAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("settings", "view");
    const config = await prisma.emailConfig.findUnique({
      where: { workspaceId: session.workspaceId },
    });
    if (!config) return ok(null);
    const masked = {
      ...config,
      apiKey: config.apiKey
        ? `brevo_${config.apiKey.slice(0, 4)}${"*".repeat(Math.max(0, config.apiKey.length - 8))}${config.apiKey.slice(-4)}`
        : "",
    };
    return ok(masked);
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to load email config");
  }
}

export async function updateEmailConfigAction(data: {
  apiKey?: string;
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
  isEnabled?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requirePerm("settings", "edit");

    if (!data.apiKey && !data.senderName && !data.senderEmail) {
      return fail("At least one field must be provided");
    }

    const existing = await prisma.emailConfig.findUnique({
      where: { workspaceId: session.workspaceId },
    });

    const updateData: Record<string, unknown> = {};
    if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
    if (data.senderName !== undefined) updateData.senderName = data.senderName;
    if (data.senderEmail !== undefined) updateData.senderEmail = data.senderEmail;
    if (data.replyToEmail !== undefined) updateData.replyToEmail = data.replyToEmail;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    let config;
    if (existing) {
      config = await prisma.emailConfig.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      config = await prisma.emailConfig.create({
        data: {
          workspaceId: session.workspaceId,
          provider: "brevo",
          apiKey: data.apiKey || "",
          senderName: data.senderName || "",
          senderEmail: data.senderEmail || "",
          replyToEmail: data.replyToEmail || null,
          isEnabled: data.isEnabled ?? true,
        },
      });
    }

    await writeAudit({
      session,
      action: "edit",
      module: "settings",
      recordId: config.id,
      description: "Updated email configuration",
    });
    revalidatePath("/settings/auth");
    return ok(config, "Email configuration saved");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to save email config: " + (e as Error).message);
  }
}

export async function testEmailAction(email: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("settings", "edit");
    if (!email) return fail("Email address is required");

    const config = await prisma.emailConfig.findUnique({
      where: { workspaceId: session.workspaceId },
    });

    if (!config || !config.apiKey) {
      return fail("Email is not configured. Please configure Brevo API key first.");
    }

    if (!config.isEnabled) {
      return fail("Email sending is disabled. Please enable it first.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        sender: { name: config.senderName, email: config.senderEmail },
        to: [{ email }],
        replyTo: config.replyToEmail ? { email: config.replyToEmail } : undefined,
        subject: "AstraPulse - Test Email",
        htmlContent: `<html><body><h2>Test Email</h2><p>This is a test email from AstraPulse.</p><p>If you received this, your email configuration is working correctly.</p></body></html>`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return fail(`Failed to send test email: ${err.message || response.statusText}`);
    }

    await writeAudit({
      session,
      action: "edit",
      module: "settings",
      description: `Sent test email to ${email}`,
    });

    return ok(undefined, "Test email sent successfully");
  } catch (e) {
    if ((e as Error).message === "FORBIDDEN") return fail("You don't have permission");
    return fail("Failed to send test email: " + (e as Error).message);
  }
}

function sanitizeAuthData(data: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "emailVerificationRequired",
    "loginOtpEnabled",
    "otpExpirationMinutes",
    "otpLength",
    "maxOtpAttempts",
    "otpResendCooldownSeconds",
    "maxOtpResends",
    "passwordMinLength",
    "passwordRequireUppercase",
    "passwordRequireLowercase",
    "passwordRequireNumber",
    "passwordRequireSpecial",
    "passwordResetExpirationMinutes",
    "sessionTimeoutMinutes",
    "forceLogoutOnPasswordChange",
    "maxFailedLoginAttempts",
    "lockoutDurationMinutes",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data && data[key] !== undefined) {
      out[key] = data[key];
    }
  }
  return out;
}
