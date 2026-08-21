"use client";

import { useRouter } from "next/navigation";
import { User, Settings, LogOut, Shield, KeyRound } from "lucide-react";
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
  onLogout: () => void;
}) {
  const router = useRouter();
  return (
    <Dropdown
      width="w-64"
      trigger={
        <button className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-slate-100" aria-label="Account menu">
          <Avatar name={name} size="sm" />
          <span className="hidden text-left md:block">
            <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-800">{name}</span>
            <span className="block text-[11px] text-slate-400">{role}</span>
          </span>
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
      </div>
      <div className="py-1">
        <DropdownItem icon={<User className="h-4 w-4" />} onClick={() => router.push("/settings")}>
          My profile
        </DropdownItem>
        <DropdownItem icon={<KeyRound className="h-4 w-4" />} onClick={() => router.push("/settings")}>
          Security & 2FA
        </DropdownItem>
        <DropdownItem icon={<Settings className="h-4 w-4" />} onClick={() => router.push("/settings")}>
          Workspace settings
        </DropdownItem>
      </div>
      <DropdownSeparator />
      <DropdownItem danger icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}