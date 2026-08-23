"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Mail,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { OtpInput } from "../components/otp-input";
import { Input, FormField, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  forgotPasswordSendOtpAction,
  verifyForgotPasswordOtpAction,
  resetPasswordWithOtpAction,
} from "./actions";
import { cn } from "@/lib/utils";

const steps = ["Enter Email", "Verify Code", "New Password", "Done"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              i < current
                ? "bg-brand-600 text-white"
                : i === current
                ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            )}
          >
            {i < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-6 rounded",
                i < current ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialEmail = searchParams.get("email") ?? "";
  const [step, setStep] = useState(initialEmail ? 1 : 0);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await forgotPasswordSendOtpAction(email);
      if (res.ok) {
        setStep(1);
        setCountdown(60);
        toast({ type: "success", title: res.message ?? "Code sent!" });
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [email, toast]);

  const handleVerifyOtp = useCallback(async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyForgotPasswordOtpAction(email, code);
      if (res.ok) {
        setStep(2);
        toast({ type: "success", title: "Code verified!" });
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [email, code, toast]);

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await resetPasswordWithOtpAction(email, code, newPassword);
      if (res.ok) {
        setStep(3);
        toast({ type: "success", title: "Password reset!" });
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [email, code, newPassword, confirmPassword, toast]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      const res = await forgotPasswordSendOtpAction(email);
      if (res.ok) {
        setCountdown(60);
        setCode("");
        setError("");
        toast({ type: "success", title: "New code sent!" });
      } else {
        toast({ type: "error", title: res.error });
      }
    } catch {
      toast({ type: "error", title: "Failed to resend" });
    } finally {
      setResending(false);
    }
  }, [email, countdown, toast]);

  const passwordRequirements = [
    { label: "Minimum 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  return (
    <AuthCard
      title="Reset Your Password"
      subtitle={step < 3 ? steps[step] : undefined}
      footer={
        step < 3 ? (
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        ) : undefined
      }
    >
      <StepIndicator current={step} />

      {step === 0 && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <FormField label="Email address" error={error} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@company.com"
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
            />
          </FormField>
          <Button type="submit" className="w-full min-h-[44px]" loading={loading}>
            Send Verification Code
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} error={error} disabled={loading} />

          {error && <FieldError error={error} />}

          <Button
            onClick={handleVerifyOtp}
            className="w-full min-h-[44px]"
            loading={loading}
            disabled={code.length !== 6}
            leftIcon={<ShieldCheck className="h-4 w-4" />}
          >
            Verify Code
          </Button>

          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Resend in <span className="font-semibold">{countdown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Resend code
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <FormField label="New password" required>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          {newPassword && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    newPassword.length >= 12
                      ? "bg-emerald-500"
                      : newPassword.length >= 8
                      ? "bg-amber-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(100, (newPassword.length / 12) * 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                {passwordRequirements.map((r) => (
                  <div key={r.label} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2
                      className={cn(
                        "h-3 w-3",
                        r.met ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"
                      )}
                    />
                    <span className={r.met ? "text-emerald-600" : "text-slate-500 dark:text-slate-400"}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FormField label="Confirm new password" required>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          {error && <FieldError error={error} />}

          <Button
            type="submit"
            className="w-full min-h-[44px]"
            loading={loading}
            disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
          >
            Reset Password
          </Button>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">
            Password reset successful! You can now log in.
          </p>
          <Button className="mt-2 min-h-[44px]" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </div>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <AuthLogo />
      <ForgotPasswordForm />
    </Suspense>
  );
}
