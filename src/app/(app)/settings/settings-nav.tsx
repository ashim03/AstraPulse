"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Shield, Lock, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_LINKS = [
  { label: "General", href: "/settings", icon: Settings },
  { label: "Roles & Permissions", href: "/settings/roles", icon: Shield, permission: "roles:view" },
  { label: "Authentication", href: "/settings/auth", icon: KeyRound, permission: "settings:auth" },
  { label: "Change Password", href: "/settings/change-password", icon: Lock },
];

export function SettingsNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();

  const filteredLinks = SETTINGS_LINKS.filter((link) => {
    if (!link.permission) return true;
    if (permissions.includes("*")) return true;
    const [module, action] = link.permission.split(":");
    return (
      permissions.includes(link.permission) ||
      permissions.includes(`${module}:*`) ||
      permissions.includes(module)
    );
  });

  return (
    <div className="flex flex-wrap gap-2">
      {filteredLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition min-h-[44px]",
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
