"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { addOrganizationAction } from "./actions";

export function AddOrganizationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    country: "",
    currency: "NPR",
    timezone: "Asia/Kathmandu",
    adminName: "",
    adminEmail: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addOrganizationAction(form);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpen(false);
        setForm({ name: "", email: "", country: "", currency: "NPR", timezone: "Asia/Kathmandu", adminName: "", adminEmail: "", password: "" });
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Add Organization
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Organization</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                New organizations get a <strong>7-day free trial</strong> with full access to all features.
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Company Name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Acme Corp"
                  />
                  <Input
                    label="Company Email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="info@acme.com"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Nepal"
                  />
                  <Select
                    label="Currency"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  >
                    <option value="NPR">NPR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </Select>
                  <Select
                    label="Timezone"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  >
                    <option value="Asia/Kathmandu">Asia/Kathmandu</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Denver">America/Denver</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                  </Select>
                </div>

                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <p className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Admin Account</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Admin Name"
                      required
                      value={form.adminName}
                      onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                      placeholder="John Doe"
                    />
                    <Input
                      label="Admin Email"
                      type="email"
                      required
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      placeholder="admin@acme.com"
                    />
                  </div>
                  <div className="mt-4">
                    <Input
                      label="Password"
                      type="password"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min. 8 characters"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending}>
                  Create Organization
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
