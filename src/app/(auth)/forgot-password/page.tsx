"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { forgotPasswordAction } from "../actions";
import { Input, FormField } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { useToast } from "@/components/ui/toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await forgotPasswordAction(email);
    setLoading(false);
    if (!res.ok) {
      toast({ type: "error", title: res.error });
      return;
    }
    toast({ type: "success", title: "Reset link sent" });
    setSent(true);
    setToken((res as { data?: string }).data ?? null);
  };

  return (
    <>
      <AuthLogo />
      <AuthCard title="Reset your password" subtitle="We'll send you a link to reset your password.">
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
            </div>
            {token && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600">Demo mode — use this reset token:</p>
                <p className="mt-1 rounded bg-white px-2 py-1.5 font-mono text-xs">{token}</p>
                <Link href={`/reset-password?token=${token}`} className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
                  Continue to reset →
                </Link>
              </div>
            )}
            <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Work email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" leftIcon={<Mail className="h-4 w-4" />} />
            </FormField>
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
            <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </AuthCard>
    </>
  );
}