"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction } from "@/app/(app)/settings/change-password/actions";

export function EmployeeChangePassword() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirm) {
      toast({ title: "Passwords do not match", type: "error" });
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
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
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
            onChange={(e) => setCurrent(e.target.value)}
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
            onChange={(e) => setNewPass(e.target.value)}
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
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${newPass.length >= i * 4 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {newPass.length < 8 ? "At least 8 characters" : newPass.length < 12 ? "Good password" : "Strong password"}
            </p>
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
            onChange={(e) => setConfirm(e.target.value)}
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
      <Button type="submit" loading={loading} leftIcon={<Lock className="h-4 w-4" />} disabled={!current || !newPass || !confirm || newPass !== confirm}>
        Update Password
      </Button>
    </form>
  );
}
