"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useState, useRef } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Upload, Building2 } from "lucide-react";
import { CURRENCIES, TIMEZONES, COUNTRIES } from "@/lib/constants";
import { updateWorkspaceSettingsAction, updateProfileAction, uploadLogoAction } from "./actions";
import { changePasswordAction } from "./change-password/actions";
import { getPasswordStrength } from "@/services/password";
import { cn } from "@/lib/utils";

export type WorkspaceSettings = {
  name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  fiscalYearStart: number;
  logo?: string | null;
};

export type ProfileSettings = { name: string; email: string };

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const strengthBarColors: Record<string, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-emerald-500",
};

export function SettingsManager({ workspace, profile, canEdit = true }: { workspace: WorkspaceSettings; profile: ProfileSettings; canEdit?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  const strengthResult = newPassword ? getPasswordStrength(newPassword) : { score: 0, label: "weak" as const, feedback: "" };
  const strength = { ...strengthResult, color: strengthResult.score < 30 ? "red" : strengthResult.score < 60 ? "orange" : strengthResult.score < 80 ? "yellow" : "green" };

  async function saveWorkspace(formData: FormData) {
    setPending(true);
    const res = await updateWorkspaceSettingsAction(formData);
    setPending(false);
    toast({ title: res.ok ? (res.message ?? "Saved") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  async function saveProfile(formData: FormData) {
    setPending(true);
    const res = await updateProfileAction(formData);
    setPending(false);
    toast({ title: res.ok ? (res.message ?? "Saved") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", type: "error" });
      return;
    }
    setPasswordPending(true);
    const res = await changePasswordAction(currentPassword, newPassword);
    setPasswordPending(false);
    toast({ title: res.ok ? (res.message ?? "Password changed") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canEdit && (
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Workspace</h2>
        <p className="mb-4 text-sm text-slate-500">Company-wide information used across reports and documents.</p>
        <form action={saveWorkspace} className="space-y-4">
          <Input label="Company name" name="name" defaultValue={workspace.name} required disabled={!canEdit} />
          <Input label="Email" name="email" type="email" defaultValue={workspace.email} required disabled={!canEdit} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone" defaultValue={workspace.phone} disabled={!canEdit} />
            <Select label="Country" name="country" defaultValue={workspace.country} disabled={!canEdit}>
              <option value="">Select country</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Currency" name="currency" defaultValue={workspace.currency} disabled={!canEdit}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Date format" name="dateFormat" defaultValue={workspace.dateFormat} disabled={!canEdit}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </Select>
          </div>
          <Select label="Timezone" name="timezone" defaultValue={workspace.timezone} disabled={!canEdit}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Fiscal year start (month 1-12)" name="fiscalYearStart" type="number" min={1} max={12} defaultValue={workspace.fiscalYearStart} disabled={!canEdit} />
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" loading={pending}>Save workspace</Button>
            </div>
          )}
        </form>
        {canEdit && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Company Logo</p>
            <LogoUpload currentLogo={workspace.logo} />
          </div>
        )}
      </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Your profile</h2>
        <p className="mb-4 text-sm text-slate-500">How you appear across the workspace.</p>
        <form action={saveProfile} className="space-y-4">
          <Input label="Display name" name="name" defaultValue={profile.name} required disabled={!canEdit} />
          <Input label="Email" value={profile.email} disabled />
          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" loading={pending}>Save profile</Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Change Password</h2>
        <p className="mb-4 text-sm text-slate-500">Update your password to keep your account secure.</p>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="label">Current password <span className="ml-0.5 text-red-500">*</span></label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">New password <span className="ml-0.5 text-red-500">*</span></label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {newPassword && (
            <div className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", strengthBarColors[strength.color])}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={cn(
                  "font-medium",
                  strength.color === "red" && "text-red-600",
                  strength.color === "orange" && "text-orange-600",
                  strength.color === "yellow" && "text-yellow-600",
                  strength.color === "green" && "text-emerald-600"
                )}>
                  {strength.label}
                </span>
                <span className="text-slate-400">{strength.score}/100</span>
              </div>
              <div className="space-y-1.5">
                {passwordRequirements.map((r) => {
                  const met = r.test(newPassword);
                  return (
                    <div key={r.label} className="flex items-center gap-2 text-sm">
                      {met ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <span className={met ? "text-emerald-600" : "text-slate-500 dark:text-slate-400"}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="label">Confirm new password <span className="ml-0.5 text-red-500">*</span></label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Passwords do not match</p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={passwordPending}
              disabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              Change Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function LogoUpload({ currentLogo }: { currentLogo?: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogo ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large (max 2MB)", type: "error" });
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("logo", file);
    try {
      const res = await uploadLogoAction(fd);
      if (res.ok) {
        toast({ title: "Logo uploaded", type: "success" });
        setPreview(URL.createObjectURL(file));
        router.refresh();
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
      toast({ title: "Upload failed", type: "error" });
    }
    setUploading(false);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
        {preview ? (
          <img src={preview} alt="Company logo" className="h-full w-full rounded-xl object-contain p-1" />
        ) : (
          <Building2 className="h-6 w-6 text-slate-400" />
        )}
      </div>
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="secondary" size="sm" leftIcon={<Upload className="h-4 w-4" />} loading={uploading} onClick={() => fileRef.current?.click()}>
          Upload logo
        </Button>
        <p className="mt-1 text-xs text-slate-400">PNG, JPG up to 2MB</p>
      </div>
    </div>
  );
}