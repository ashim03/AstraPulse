"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction } from "@/app/(app)/settings/change-password/actions";

const requirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function EmployeeChangePassword() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const allMet = newPass ? requirements.every((r) => r.test(newPass)) : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPass !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await changePasswordAction(current, newPass);
      if (res.ok) {
        toast({ title: res.message ?? "Password changed successfully", type: "success" });
        setCurrent("");
        setNewPass("");
        setConfirm("");
        setError("");
      } else {
        setError(res.error);
        toast({ title: res.error, type: "error" });
      }
    } catch {
      setError("Something went wrong. Please try again.");
      toast({ title: "Something went wrong", type: "error" });
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Current password
        </label>
        <div className="relative">
          <input
            id="current-password"
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setError(""); }}
            className="input pr-10"
            required
            autoComplete="current-password"
          />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPass}
            onChange={(e) => { setNewPass(e.target.value); setError(""); }}
            className="input pr-10"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {newPass && (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${newPass.length >= i * 4 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
              ))}
            </div>
            <div className="space-y-1">
              {requirements.map((r) => {
                const met = r.test(newPass);
                return (
                  <div key={r.label} className="flex items-center gap-1.5 text-xs">
                    {met ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
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
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Confirm new password
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
            className="input pr-10"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && newPass !== confirm && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} leftIcon={<Lock className="h-4 w-4" />} disabled={!current || !newPass || !confirm || newPass !== confirm || !allMet}>
        Update Password
      </Button>
    </form>
  );
}
