import { prisma } from "@/lib/prisma";

type EmailParams = {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  replyTo?: { email: string; name?: string };
  params?: Record<string, string>;
};

type BrevoConfig = {
  apiKey: string;
  senderName: string;
  senderEmail: string;
  replyTo?: string;
};

export async function getBrevoConfig(workspaceId: string): Promise<BrevoConfig | null> {
  try {
    const config = await prisma.emailConfig.findUnique({
      where: { workspaceId },
    });
    if (config && config.isEnabled) {
      return {
        apiKey: config.apiKey,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        replyTo: config.replyToEmail ?? undefined,
      };
    }
  } catch {
    // fall through to env vars
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (apiKey && senderName && senderEmail) {
    return { apiKey, senderName, senderEmail };
  }
  return null;
}

export async function sendEmail(
  workspaceId: string,
  params: EmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getBrevoConfig(workspaceId);
  if (!config) {
    return { success: false, error: "Email service not configured" };
  }

  try {
    const body: Record<string, unknown> = {
      sender: { name: config.senderName, email: config.senderEmail },
      to: params.to,
      subject: params.subject,
      htmlContent: params.htmlContent,
    };

    if (params.replyTo) {
      body.replyTo = params.replyTo;
    } else if (config.replyTo) {
      body.replyTo = { email: config.replyTo };
    }

    if (params.params) {
      body.params = params.params;
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, messageId: data.messageId };
    }

    const err = await res.json().catch(() => ({}));
    const msg =
      err?.message ?? err?.error?.message ?? `Brevo API error: ${res.status}`;
    return { success: false, error: msg };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to send email",
    };
  }
}

function wrapTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background:#6366f1;padding:32px 40px;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">AstraPulse</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 20px;color:#1a1a2e;font-size:20px;font-weight:600;">${title}</h2>
    ${body}
  </td></tr>
  <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">This is an automated message from AstraPulse. Please do not reply.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function brandButton(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;margin:8px 0;">${text}</a>`;
}

export async function sendPasswordChangeConfirmation(
  workspaceId: string,
  to: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const greeting = name ? `Hi ${name},` : "Hello,";

  const html = wrapTemplate(
    "Password Changed Successfully",
    `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">${greeting}</p>
     <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">Your AstraPulse account password has been changed successfully.</p>
     <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin:16px 0;">
       <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5;"><strong>Security Notice:</strong> If you did not make this change, please contact your administrator immediately and reset your password.</p>
     </div>
     <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">For your security, all other sessions have been logged out.</p>`
  );

  const result = await sendEmail(workspaceId, {
    to: [{ email: to, name }],
    subject: "Password Changed — AstraPulse",
    htmlContent: html,
  });
  return { success: result.success, error: result.error };
}

export async function sendPasswordResetEmail(
  workspaceId: string,
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
  const greeting = name ? `Hi ${name},` : "Hello,";

  const html = wrapTemplate(
    "Reset Your Password",
    `<p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">${greeting}</p>
     <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">We received a request to reset the password for your AstraPulse account. Click the button below to set a new password:</p>
     ${brandButton(resetUrl, "Reset Password")}
     <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">This link expires in <strong>15 minutes</strong>.</p>
     <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">If you did not request a password reset, please ignore this email — your account will remain secure.</p>
     <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">If the button above doesn't work, copy and paste this URL into your browser:<br><a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a></p>`
  );

  const result = await sendEmail(workspaceId, {
    to: [{ email: to, name }],
    subject: "Reset Your Password — AstraPulse",
    htmlContent: html,
  });
  return { success: result.success, error: result.error };
}
