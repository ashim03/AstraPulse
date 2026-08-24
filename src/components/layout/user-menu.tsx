"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, Settings, LogOut, Shield, Building2 } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({
  name,
  email,
  role,
  onLogout,
}: {
  name: string;
  email: string;
  role?: string;
  onLogout: () => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    setLoading(true);
    try {
      await onLogout();
    } catch {}
    router.push("/login");
    router.refresh();
  };

  return (
    <Dropdown
      width="w-64"
      trigger={
        <button className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Account menu">
          <Avatar name={name} size="sm" />
          <span className="hidden text-left md:block">
            <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{name}</span>
            <span className="block text-[11px] text-slate-400 dark:text-slate-500">{role}</span>
          </span>
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
        </div>
      </div>
      <div className="py-1">
        <DropdownItem icon={<User className="h-4 w-4" />} onClick={() => router.push("/settings")}>
          My profile
        </DropdownItem>
        <DropdownItem icon={<Shield className="h-4 w-4" />} onClick={() => router.push("/settings/change-password")}>
          Change password
        </DropdownItem>
        {role === "Workspace Admin" && (
          <DropdownItem icon={<Building2 className="h-4 w-4" />} onClick={() => router.push("/settings")}>
            Workspace settings
          </DropdownItem>
        )}
      </div>
      <DropdownSeparator />
      <DropdownItem danger icon={<LogOut className="h-4 w-4" />} onClick={handleLogout} disabled={loading}>
        {loading ? "Signing out..." : "Sign out"}
      </DropdownItem>
    </Dropdown>
  );
}
