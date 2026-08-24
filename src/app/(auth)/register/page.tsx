"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Lock, Mail, User, Eye, EyeOff, MapPin, Globe, Coins, Clock } from "lucide-react";
import { registerAction } from "../actions";
import { Input, Select, FormField, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthLogo } from "../components/auth-card";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, TIMEZONES, COUNTRIES, BUSINESS_TYPES } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    adminName: "",
    phone: "",
    country: "Nepal",
    currency: "NPR",
    timezone: "Asia/Kathmandu",
    businessType: "Technology",
    password: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    setFieldErrors({});
    try {
      const res = await registerAction(form);
      setLoading(false);
      if (!res.ok) {
        setFormError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      window.location.href = "/";
    } catch (err: any) {
      setLoading(false);
      if (err?.digest?.startsWith("NEXT_REDIRECT")) {
        return;
      }
      throw err;
    }
  };

  return (
    <>
      <AuthLogo />
      <AuthCard
        title="Create your company workspace"
        subtitle="Set up AstraPulse for your business in under a minute"
        footer={
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Company name" required error={fieldErrors.companyName}>
            <Input value={form.companyName} onChange={set("companyName")} placeholder="Acme Corporation" leftIcon={<Building2 className="h-4 w-4" />} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Company email" required error={fieldErrors.email}>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="admin@company.com" leftIcon={<Mail className="h-4 w-4" />} />
            </FormField>
            <FormField label="Admin name" required error={fieldErrors.adminName}>
              <Input value={form.adminName} onChange={set("adminName")} placeholder="Jane Doe" leftIcon={<User className="h-4 w-4" />} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Phone">
              <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" leftIcon={<PhoneIcon />} />
            </FormField>
            <FormField label="Country">
              <Select value={form.country} onChange={set("country")}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Currency">
              <Select value={form.currency} onChange={set("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Timezone">
              <Select value={form.timezone} onChange={set("timezone")}>
                {TIMEZONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Business type">
            <Select value={form.businessType} onChange={set("businessType")}>
              {BUSINESS_TYPES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Password" required hint="At least 8 characters" error={fieldErrors.password}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Create a strong password"
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
          {formError && <FieldError error={formError} />}
          <Button type="submit" className="w-full" loading={loading}>
            Create workspace & get started
          </Button>
          <p className="text-center text-xs text-slate-400">
            By registering you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>
      </AuthCard>
    </>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}