"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { Input, FormField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  forgotPasswordSendTokenAction,
  verifyResetTokenAction,
  resetPasswordWithTokenAction,
} from "./actions";
import { cn } from "@/lib/utils";

const steps = ["Enter Email", "Enter Code", "New Password", "Done"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              i < current
                ? "bg-emerald-500 text-white"
                : i === current
                ? "bg-indigo-600 text-white"
                : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            )}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-6",
                i < current ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const { toast } = useToast();

  const [step, setStep] = useState(tokenParam ? 2 : 0);
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState(tokenParam || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await forgotPasswordSendTokenAction(email);
      setLoading(false);
      if (res.ok) {
        toast({ type: "success", title: "Reset code sent" });
        setStep(1);
      } else {
        setError(res.error);
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }, [email, toast]);

  const handleVerifyCode = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await verifyResetTokenAction(resetToken);
      setLoading(false);
      if (res.ok) {
        toast({ type: "success", title: "Code verified" });
        setStep(2);
      } else {
        setError(res.error);
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }, [resetToken, toast]);

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordWithTokenAction(resetToken, newPassword);
      setLoading(false);
      if (res.ok) {
        toast({ type: "success", title: "Password reset successful" });
        setStep(3);
      } else {
        setError(res.error);
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }, [resetToken, newPassword, confirmPassword, toast]);

  return (
    <AuthCard
      title="Reset Password"
      subtitle="We'll send you a code to reset your password"
      footer={
        <>
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <StepIndicator current={step} />

      {step === 0 && (
        <form onSubmit={handleSendCode} className="space-y-4">
          <FormField label="Email address" error={error && !email ? error : undefined}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />
          </FormField>
          {error && email && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Send Reset Code
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter the 32-character reset code sent to <strong>{email}</strong>
          </p>
          <FormField label="Reset code">
            <Input
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste your reset code"
              className="font-mono text-sm"
            />
          </FormField>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleVerifyCode} loading={loading} className="flex-1">
              Verify Code
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              await forgotPasswordSendTokenAction(email);
              setLoading(false);
              toast({ type: "info", title: "New code sent" });
            }}
            className="text-sm text-indigo-600 hover:underline w-full text-center"
            disabled={loading}
          >
            Resend code
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <FormField label="New password">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Confirm password">
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              required
            />
          </FormField>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => setStep(1)} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Reset Password
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Password Reset Successfully
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link href="/login">
            <Button className="w-full">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 px-4">
      <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
