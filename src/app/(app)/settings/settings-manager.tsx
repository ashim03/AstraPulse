"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { updateWorkspaceSettingsAction, updateProfileAction } from "./actions";

export type WorkspaceSettings = {
  name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  fiscalYearStart: number;
};

export type ProfileSettings = { name: string; email: string };

export function SettingsManager({ workspace, profile }: { workspace: WorkspaceSettings; profile: ProfileSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function saveWorkspace(formData: FormData) {
    setPending(true);
    const res = await updateWorkspaceSettingsAction(formData);
    setPending(false);
    toast({ title: res.ok ? (res.message ?? "Saved") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  async function saveProfile(formData: FormData) {
    setPending(true);
    const res = await updateProfileAction(formData);
    setPending(false);
    toast({ title: res.ok ? (res.message ?? "Saved") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Workspace</h2>
        <p className="mb-4 text-sm text-slate-500">Company-wide information used across reports and documents.</p>
        <form action={saveWorkspace} className="space-y-4">
          <Input label="Company name" name="name" defaultValue={workspace.name} required />
          <Input label="Email" name="email" type="email" defaultValue={workspace.email} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone" defaultValue={workspace.phone} />
            <Input label="Country" name="country" defaultValue={workspace.country} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Currency" name="currency" defaultValue={workspace.currency}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Date format" name="dateFormat" defaultValue={workspace.dateFormat}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </Select>
          </div>
          <Select label="Timezone" name="timezone" defaultValue={workspace.timezone}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Fiscal year start (month 1-12)" name="fiscalYearStart" type="number" min={1} max={12} defaultValue={workspace.fiscalYearStart} />
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>Save workspace</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Your profile</h2>
        <p className="mb-4 text-sm text-slate-500">How you appear across the workspace.</p>
        <form action={saveProfile} className="space-y-4">
          <Input label="Display name" name="name" defaultValue={profile.name} required />
          <Input label="Email" value={profile.email} disabled />
          <div className="flex justify-end">
            <Button type="submit" loading={pending}>Save profile</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}