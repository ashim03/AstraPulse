"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Lock, KeyRound } from "lucide-react";
import { resetPasswordAction } from "../actions";
import { Input, FormField, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { useToast } from "@/components/ui/toast";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await resetPasswordAction(token, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ type: "success", title: "Password updated" });
    router.push("/login");
  };

  return (
    <AuthCard title="Choose a new password" subtitle="Enter your new password to regain access.">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="New password" hint="At least 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" leftIcon={<Lock className="h-4 w-4" />} />
        </FormField>
        <FormField label="Confirm new password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" leftIcon={<KeyRound className="h-4 w-4" />} />
        </FormField>
        {error && <FieldError error={error} />}
        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
        <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <AuthLogo />
      <ResetForm />
    </Suspense>
  );
}