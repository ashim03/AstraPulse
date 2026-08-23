"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { OtpInput } from "../components/otp-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { verifyLoginOtpAction, resendLoginOtpAction } from "../actions";

function LoginOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const email = searchParams.get("email") ?? "";
  const next = searchParams.get("next") ?? "/";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState("");

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
      const res = await verifyLoginOtpAction(email, code);
      if (res.ok) {
        toast({ type: "success", title: "Authenticated securely" });
        router.push(next);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [code, email, next, toast, router]);

  const handleResend = useCallback(async () => {
    if (!email || countdown > 0) return;
    setResending(true);
    try {
      const res = await resendLoginOtpAction(email);
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
      <AuthCard title="Two-Factor Verification" subtitle="No email address provided.">
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Two-Factor Verification"
      subtitle="Enter the code sent to your email"
    >
      <div className="space-y-4">
        <OtpInput value={code} onChange={setCode} error={error} disabled={loading} />

        {error && (
          <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <Button
          onClick={handleVerify}
          className="w-full min-h-[44px]"
          loading={loading}
          disabled={code.length !== 6}
          leftIcon={<ShieldCheck className="h-4 w-4" />}
        >
          Verify & Sign In
        </Button>

        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>

          {countdown > 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Resend in{" "}
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

export default function LoginOtpPage() {
  return (
    <Suspense>
      <AuthLogo />
      <LoginOtpForm />
    </Suspense>
  );
}
