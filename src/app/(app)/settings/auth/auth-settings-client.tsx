"use client";

import { useState, useTransition } from "react";
import { Mail, Shield, Eye, EyeOff, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/input";
import {
  getAuthSettingsAction,
  updateAuthSettingsAction,
  getEmailConfigAction,
  updateEmailConfigAction,
  testEmailAction,
} from "./actions";

type AuthSettings = {
  id: string;
  emailVerificationRequired: boolean;
  loginOtpEnabled: boolean;
  otpExpirationMinutes: number;
  otpLength: number;
  maxOtpAttempts: number;
  otpResendCooldownSeconds: number;
  maxOtpResends: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordResetExpirationMinutes: number;
  sessionTimeoutMinutes: number;
  forceLogoutOnPasswordChange: boolean;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
};

type EmailConfig = {
  id: string;
  apiKey: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  isEnabled: boolean;
} | null;

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/50">{children}</div>}
    </div>
  );
}

export function AuthSettingsClient({
  initialAuthSettings,
  initialEmailConfig,
}: {
  initialAuthSettings: AuthSettings;
  initialEmailConfig: EmailConfig;
}) {
  const [authSettings, setAuthSettings] = useState<AuthSettings>(initialAuthSettings);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(initialEmailConfig);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [emailPending, setEmailPending] = useTransition();
  const [testPending, setTestPending] = useTransition();
  const [authMessage, setAuthMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [emailDraft, setEmailDraft] = useState({
    apiKey: "",
    senderName: emailConfig?.senderName || "",
    senderEmail: emailConfig?.senderEmail || "",
    replyToEmail: emailConfig?.replyToEmail || "",
    isEnabled: emailConfig?.isEnabled ?? true,
  });

  const updateAuth = (key: keyof AuthSettings, value: boolean | number) => {
    setAuthSettings((prev) => ({ ...prev, [key]: value }));
    setAuthMessage(null);
  };

  const saveAuthSettings = () => {
    setAuthMessage(null);
    startTransition(async () => {
      const result = await updateAuthSettingsAction(authSettings);
      if (result.ok) {
        setAuthMessage({ type: "success", text: result.message || "Settings saved" });
      } else {
        setAuthMessage({ type: "error", text: result.error });
      }
    });
  };

  const saveEmailConfig = () => {
    setEmailMessage(null);
    setEmailPending(async () => {
      const result = await updateEmailConfigAction({
        apiKey: emailDraft.apiKey || undefined,
        senderName: emailDraft.senderName || undefined,
        senderEmail: emailDraft.senderEmail || undefined,
        replyToEmail: emailDraft.replyToEmail || undefined,
        isEnabled: emailDraft.isEnabled,
      });
      if (result.ok) {
        setEmailMessage({ type: "success", text: result.message || "Email config saved" });
        if (emailDraft.apiKey) {
          setEmailConfig((prev) => prev ? { ...prev, apiKey: `brevo_${emailDraft.apiKey.slice(0, 4)}${"*".repeat(Math.max(0, emailDraft.apiKey.length - 8))}${emailDraft.apiKey.slice(-4)}` } : prev);
        }
      } else {
        setEmailMessage({ type: "error", text: result.error });
      }
    });
  };

  const sendTestEmail = () => {
    setTestMessage(null);
    setTestPending(async () => {
      const result = await testEmailAction(testEmail);
      if (result.ok) {
        setTestMessage({ type: "success", text: result.message || "Test email sent" });
        setTestEmail("");
      } else {
        setTestMessage({ type: "error", text: result.error });
      }
    });
  };

  const inputClass = "min-h-[44px] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Email Configuration"
            subtitle="Configure Brevo SMTP settings for transactional emails"
            action={<Mail className="h-5 w-5 text-slate-400" />}
          />
          <CardBody className="space-y-4">
            <div>
              <label className="label">Brevo API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={emailConfig ? emailConfig.apiKey : "Enter Brevo API Key"}
                  value={emailDraft.apiKey}
                  onChange={(e) => setEmailDraft((p) => ({ ...p, apiKey: e.target.value }))}
                  className={inputClass + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {emailConfig && !emailDraft.apiKey && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Current: {emailConfig.apiKey}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Sender Name"
                placeholder="AstraPulse"
                value={emailDraft.senderName}
                onChange={(e) => setEmailDraft((p) => ({ ...p, senderName: e.target.value }))}
                className={inputClass}
              />
              <Input
                label="Sender Email"
                placeholder="noreply@astrapulse.com"
                value={emailDraft.senderEmail}
                onChange={(e) => setEmailDraft((p) => ({ ...p, senderEmail: e.target.value }))}
                className={inputClass}
              />
            </div>

            <Input
              label="Reply-to Email"
              placeholder="support@astrapulse.com"
              value={emailDraft.replyToEmail}
              onChange={(e) => setEmailDraft((p) => ({ ...p, replyToEmail: e.target.value }))}
              className={inputClass}
            />

            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable Email Sending</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Toggle to enable or disable outgoing emails</p>
              </div>
              <Switch
                checked={emailDraft.isEnabled}
                onCheckedChange={(v) => setEmailDraft((p) => ({ ...p, isEnabled: v }))}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Send Test Email</p>
              <div className="flex gap-2">
                <Input
                  placeholder="test@example.com"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className={inputClass}
                />
                <Button
                  variant="outline"
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={sendTestEmail}
                  loading={testPending}
                  className="min-h-[44px]"
                >
                  Send
                </Button>
              </div>
              {testMessage && (
                <p className={`mt-2 text-xs ${testMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                  {testMessage.text}
                </p>
              )}
            </div>

            {emailMessage && (
              <p className={`text-xs ${emailMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {emailMessage.text}
              </p>
            )}
          </CardBody>
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 sm:px-5 sm:py-3.5 flex justify-end">
            <Button onClick={saveEmailConfig} loading={emailPending} className="min-h-[44px]">
              Save Email Config
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Authentication Settings"
            subtitle="Configure authentication, OTP, and security policies"
            action={<Shield className="h-5 w-5 text-slate-400" />}
          />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Email Verification</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Require users to verify their email before accessing the system</p>
              </div>
              <Switch
                checked={authSettings.emailVerificationRequired}
                onCheckedChange={(v) => updateAuth("emailVerificationRequired", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Login OTP</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Require OTP verification for staff login</p>
              </div>
              <Switch
                checked={authSettings.loginOtpEnabled}
                onCheckedChange={(v) => updateAuth("loginOtpEnabled", v)}
              />
            </div>

            <CollapsibleSection title="OTP Settings" icon={<Shield className="h-4 w-4 text-violet-500" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="OTP Expiration (minutes)"
                  type="number"
                  min={1}
                  max={30}
                  value={authSettings.otpExpirationMinutes}
                  onChange={(e) => updateAuth("otpExpirationMinutes", parseInt(e.target.value) || 5)}
                  className={inputClass}
                />
                <Input
                  label="OTP Length (digits)"
                  type="number"
                  min={4}
                  max={8}
                  value={authSettings.otpLength}
                  onChange={(e) => updateAuth("otpLength", parseInt(e.target.value) || 6)}
                  className={inputClass}
                />
                <Input
                  label="Max OTP Attempts"
                  type="number"
                  min={1}
                  max={20}
                  value={authSettings.maxOtpAttempts}
                  onChange={(e) => updateAuth("maxOtpAttempts", parseInt(e.target.value) || 5)}
                  className={inputClass}
                />
                <Input
                  label="Resend Cooldown (seconds)"
                  type="number"
                  min={10}
                  max={300}
                  value={authSettings.otpResendCooldownSeconds}
                  onChange={(e) => updateAuth("otpResendCooldownSeconds", parseInt(e.target.value) || 60)}
                  className={inputClass}
                />
                <Input
                  label="Max OTP Resends"
                  type="number"
                  min={1}
                  max={10}
                  value={authSettings.maxOtpResends}
                  onChange={(e) => updateAuth("maxOtpResends", parseInt(e.target.value) || 3)}
                  className={inputClass}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Password Requirements" icon={<Shield className="h-4 w-4 text-emerald-500" />}>
              <Input
                label="Minimum Length"
                type="number"
                min={4}
                max={128}
                value={authSettings.passwordMinLength}
                onChange={(e) => updateAuth("passwordMinLength", parseInt(e.target.value) || 8)}
                className={inputClass}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Require Uppercase</span>
                  <Switch
                    checked={authSettings.passwordRequireUppercase}
                    onCheckedChange={(v) => updateAuth("passwordRequireUppercase", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Require Lowercase</span>
                  <Switch
                    checked={authSettings.passwordRequireLowercase}
                    onCheckedChange={(v) => updateAuth("passwordRequireLowercase", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Require Number</span>
                  <Switch
                    checked={authSettings.passwordRequireNumber}
                    onCheckedChange={(v) => updateAuth("passwordRequireNumber", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                  <span className="text-sm text-slate-700 dark:text-slate-200">Require Special Char</span>
                  <Switch
                    checked={authSettings.passwordRequireSpecial}
                    onCheckedChange={(v) => updateAuth("passwordRequireSpecial", v)}
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Session & Security" icon={<Shield className="h-4 w-4 text-amber-500" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Password Reset Expiration (min)"
                  type="number"
                  min={5}
                  max={1440}
                  value={authSettings.passwordResetExpirationMinutes}
                  onChange={(e) => updateAuth("passwordResetExpirationMinutes", parseInt(e.target.value) || 15)}
                  className={inputClass}
                />
                <Input
                  label="Session Timeout (minutes)"
                  type="number"
                  min={15}
                  max={10080}
                  value={authSettings.sessionTimeoutMinutes}
                  onChange={(e) => updateAuth("sessionTimeoutMinutes", parseInt(e.target.value) || 480)}
                  className={inputClass}
                />
                <Input
                  label="Max Failed Login Attempts"
                  type="number"
                  min={1}
                  max={50}
                  value={authSettings.maxFailedLoginAttempts}
                  onChange={(e) => updateAuth("maxFailedLoginAttempts", parseInt(e.target.value) || 5)}
                  className={inputClass}
                />
                <Input
                  label="Lockout Duration (minutes)"
                  type="number"
                  min={1}
                  max={1440}
                  value={authSettings.lockoutDurationMinutes}
                  onChange={(e) => updateAuth("lockoutDurationMinutes", parseInt(e.target.value) || 30)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Force Logout on Password Change</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invalidate all sessions when user changes their password</p>
                </div>
                <Switch
                  checked={authSettings.forceLogoutOnPasswordChange}
                  onCheckedChange={(v) => updateAuth("forceLogoutOnPasswordChange", v)}
                />
              </div>
            </CollapsibleSection>

            {authMessage && (
              <p className={`text-xs ${authMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                {authMessage.text}
              </p>
            )}
          </CardBody>
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 sm:px-5 sm:py-3.5 flex justify-end">
            <Button onClick={saveAuthSettings} loading={pending} className="min-h-[44px]">
              Save Auth Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
