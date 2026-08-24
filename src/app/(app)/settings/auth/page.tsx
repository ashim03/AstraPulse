import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { AuthSettingsClient } from "./auth-settings-client";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AuthSettingsPage() {
  const session = await requireSession();
  if (!hasPermission(session, "settings", "auth")) {
    redirect("/?error=access_denied");
  }

  let authSettings = await prisma.authSettings.findUnique({
    where: { workspaceId: session.workspaceId },
  });
  if (!authSettings) {
    authSettings = await prisma.authSettings.create({
      data: { workspaceId: session.workspaceId },
    });
  }

  const emailConfig = await prisma.emailConfig.findUnique({
    where: { workspaceId: session.workspaceId },
  });

  const serializedAuthSettings = {
    id: authSettings.id,
    passwordMinLength: authSettings.passwordMinLength,
    passwordRequireUppercase: authSettings.passwordRequireUppercase,
    passwordRequireLowercase: authSettings.passwordRequireLowercase,
    passwordRequireNumber: authSettings.passwordRequireNumber,
    passwordRequireSpecial: authSettings.passwordRequireSpecial,
    passwordResetExpirationMinutes: authSettings.passwordResetExpirationMinutes,
    sessionTimeoutMinutes: authSettings.sessionTimeoutMinutes,
    forceLogoutOnPasswordChange: authSettings.forceLogoutOnPasswordChange,
    maxFailedLoginAttempts: authSettings.maxFailedLoginAttempts,
    lockoutDurationMinutes: authSettings.lockoutDurationMinutes,
  };

  const serializedEmailConfig = emailConfig
    ? {
        id: emailConfig.id,
        apiKey: `brevo_${emailConfig.apiKey.slice(0, 4)}${"*".repeat(Math.max(0, emailConfig.apiKey.length - 8))}${emailConfig.apiKey.slice(-4)}`,
        senderName: emailConfig.senderName,
        senderEmail: emailConfig.senderEmail,
        replyToEmail: emailConfig.replyToEmail,
        isEnabled: emailConfig.isEnabled,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Authentication Settings"
        subtitle="Configure email, OTP, password policies, and security settings"
        breadcrumb="Settings"
      />
      <AuthSettingsClient
        initialAuthSettings={serializedAuthSettings}
        initialEmailConfig={serializedEmailConfig}
      />
    </div>
  );
}
