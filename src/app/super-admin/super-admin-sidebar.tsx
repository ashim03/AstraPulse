"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, CreditCard, Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
  { label: "Organizations", href: "/super-admin/organizations", icon: Building2 },
  { label: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
];

export default function SuperAdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-4 dark:border-slate-700">
        <Link href="/super-admin" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">AstraPulse Admin</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Super Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Platform
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/super-admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />}
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-700">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            {userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{userName}</p>
            <p className="truncate text-[11px] text-slate-400">Super Admin</p>
          </div>
          <a href="/api/auth/logout" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300" title="Logout">
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}
