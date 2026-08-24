"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Input, FormField, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { useToast } from "@/components/ui/toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!data.ok) {
        setFormError(data.error);
        return;
      }
      const next = searchParams.get("next");
      window.location.href = next || data.redirect || "/";
    } catch {
      setLoading(false);
      setFormError("Something went wrong. Please try again.");
    }
  };

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
