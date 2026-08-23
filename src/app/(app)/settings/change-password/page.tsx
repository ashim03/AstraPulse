"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, FormField, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction } from "./actions";
import { getPasswordStrength } from "@/services/password";
import { cn } from "@/lib/utils";

const requirements = [
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

export default function ChangePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strengthResult = newPassword ? getPasswordStrength(newPassword) : { score: 0, label: "weak" as const, feedback: "" };
  const strength = { ...strengthResult, color: strengthResult.score < 30 ? "red" : strengthResult.score < 60 ? "orange" : strengthResult.score < 80 ? "yellow" : "green" };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    setFieldErrors({});
    try {
      const res = await changePasswordAction(currentPassword, newPassword);
      if (res.ok) {
        toast({ type: "success", title: res.message ?? "Password changed!" });
        router.push("/settings");
      } else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, toast, router]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Change Password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Update your password to keep your account secure.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Current password" error={fieldErrors.currentPassword} required>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="current-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField label="New password" error={fieldErrors.newPassword} required>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          {newPassword && (
            <div className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    strengthBarColors[strength.color]
                  )}
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
                {requirements.map((r) => {
                  const met = r.test(newPassword);
                  return (
                    <div key={r.label} className="flex items-center gap-2 text-sm">
                      {met ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <span className={met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <FormField label="Confirm new password" error={fieldErrors.confirmPassword} required>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Passwords do not match
            </p>
          )}

          {error && <FieldError error={error} />}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.push("/settings")}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
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
