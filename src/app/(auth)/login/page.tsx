"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { loginAction, verifyTwoFactorAction } from "../actions";
import { Input, FormField, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthLogo, DemoAccounts } from "../components/auth-card";
import { useToast } from "@/components/ui/toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("admin@nova.local");
  const [password, setPassword] = useState("Admin@123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    setFieldErrors({});
    const res = await loginAction({ email, password });
    setLoading(false);
    if (!res.ok) {
      setFormError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    if (res.data?.need2fa) {
      setNeed2fa(true);
      setUserId(res.data.userId ?? null);
      return;
    }
    if (res.data?.requiresOtp) {
      toast({ type: "info", title: "Verification code sent to your email" });
      router.push(`/login-otp?email=${encodeURIComponent(res.data.email ?? email)}`);
      return;
    }
    toast({ type: "success", title: res.message ?? "Signed in" });
    const next = searchParams.get("next");
    if (next) {
      router.push(next);
    } else {
      router.push("/");
    }
    router.refresh();
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    const res = await verifyTwoFactorAction(userId, code);
    setLoading(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    toast({ type: "success", title: "Authenticated securely" });
    router.push("/");
    router.refresh();
  };

  if (need2fa) {
    return (
      <AuthCard
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app to continue."
      >
        <form onSubmit={submit2fa} className="space-y-4">
          <FormField label="Verification code" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="text-center text-lg font-semibold tracking-[0.4em]"
            />
          </FormField>
          {formError && <FieldError error={formError} />}
          <Button type="submit" className="w-full" loading={loading} leftIcon={<ShieldCheck className="h-4 w-4" />}>
            Verify & sign in
          </Button>
          <button
            type="button"
            onClick={() => {
              setNeed2fa(false);
              setFormError("");
            }}
            className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Back to sign in
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in to AstraPulse"
      subtitle="Access your workspace dashboard"
      footer={
        <>
          Don't have an account?{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            Register your company
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Work email" error={fieldErrors.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            leftIcon={<Mail className="h-4 w-4" />}
          />
        </FormField>
        <FormField label="Password" error={fieldErrors.password}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              leftIcon={<Lock className="h-4 w-4" />}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Toggle password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-600" defaultChecked />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        {formError && <FieldError error={formError} />}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <DemoAccounts />
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthLogo />
      <LoginForm />
    </Suspense>
  );
}