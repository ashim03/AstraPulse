"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MailCheck, Loader2, RefreshCw } from "lucide-react";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { OtpInput } from "../components/otp-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { verifyEmailAction, resendVerificationAction } from "./actions";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local[0] + "***";
  return `${masked}@${domain}`;
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const email = searchParams.get("email") ?? "";
  const type = searchParams.get("type") ?? "registration";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !email) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyEmailAction(email, code);
      if (res.ok) {
        setVerified(true);
        toast({ type: "success", title: "Email verified!" });
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(res.error);
        const remaining = res.fieldErrors?.remainingAttempts;
        if (remaining) setRemainingAttempts(parseInt(remaining, 10));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [code, email, toast, router]);

  const handleResend = useCallback(async () => {
    if (!email || countdown > 0) return;
    setResending(true);
    try {
      const res = await resendVerificationAction(email);
      if (res.ok) {
        toast({ type: "success", title: "New code sent!" });
        setCountdown(60);
        setCode("");
        setError("");
      } else {
        toast({ type: "error", title: res.error });
        const waitSec = res.fieldErrors?.waitSeconds;
        if (waitSec) setCountdown(parseInt(waitSec, 10));
      }
    } catch {
      toast({ type: "error", title: "Failed to resend code" });
    } finally {
      setResending(false);
    }
  }, [email, countdown, toast]);

  if (!email) {
    return (
      <AuthCard title="Verify Your Email" subtitle="No email address provided.">
        <p className="text-sm text-slate-500">Please register or log in first.</p>
        <Button className="w-full mt-4" onClick={() => router.push("/login")}>
          Go to Login
        </Button>
      </AuthCard>
    );
  }

  if (verified) {
    return (
      <AuthCard title="Email Verified!" subtitle="Redirecting to login...">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <MailCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-slate-500">Email verified! Redirecting to login...</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify Your Email"
      subtitle={`We've sent a verification code to ${maskEmail(email)}`}
    >
      <div className="space-y-4">
        <OtpInput value={code} onChange={setCode} error={error} disabled={loading} />

        {error && (
          <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
            {error}
            {remainingAttempts !== null && remainingAttempts > 0 && (
              <span className="block mt-0.5 text-xs text-slate-500">
                {remainingAttempts} attempt(s) remaining
              </span>
            )}
          </p>
        )}

        <Button
          onClick={handleVerify}
          className="w-full min-h-[44px]"
          loading={loading}
          disabled={code.length !== 6}
        >
          Verify Email
        </Button>

        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Resend code in{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {countdown}s
              </span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Resend code
            </button>
          )}
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <AuthLogo />
      <VerifyEmailForm />
    </Suspense>
  );
}
