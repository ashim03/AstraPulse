"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirm) {
      toast({ title: "Passwords do not match", type: "error" });
      return;
    }
    setLoading(true);
    const res = await changePasswordAction(current, newPass);
    setLoading(false);
    if (res.ok) {
      toast({ title: res.message ?? "Password changed", type: "success" });
      setCurrent("");
      setNewPass("");
      setConfirm("");
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Current password</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input pr-10"
            required
          />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">New password</label>
        <div className="relative">
          <input
            type={showNew ? "text" : "password"}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="input pr-10"
            required
            minLength={8}
          />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
          required
          minLength={8}
        />
      </div>
      <Button type="submit" loading={loading} leftIcon={<Lock className="h-4 w-4" />}>
        Update Password
      </Button>
    </form>
  );
}
