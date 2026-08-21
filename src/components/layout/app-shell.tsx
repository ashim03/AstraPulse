"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CalendarCheck, Wallet, Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, MobileDrawer } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { NotificationsPopover, type Notif } from "./notifications";
import { UserMenu } from "./user-menu";

const BOTTOM_NAV = [
  { label: "Home", href: "/", icon: Home },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Payroll", href: "/payroll", icon: Wallet },
  { label: "Menu", href: "", icon: Menu },
];

export function AppShell({
  user,
  workspace,
  notifications,
  unreadCount,
  children,
}: {
  user: { name: string; email: string; role?: string; onLogout: () => void };
  workspace: { name: string; plan?: string; status?: string };
  notifications: Notif[];
  unreadCount: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        workspaceName={workspace.name}
        workspacePlan={workspace.plan}
        unreadCount={unreadCount}
      />
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        workspaceName={workspace.name}
        workspacePlan={workspace.plan}
        unreadCount={unreadCount}
      />

      <div className={cn("flex min-h-screen flex-col transition-all duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 md:flex">
              <Sparkles className="h-3 w-3" />
              {workspace.plan ?? "Trial"}
            </span>
            <NotificationsPopover notifications={notifications} unread={unreadCount} />
            <UserMenu name={user.name} email={user.email} role={user.role} onLogout={user.onLogout} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-6">{children}</main>

        <footer className="hidden lg:block">
          <div className="border-t border-slate-200 px-8 py-4 text-center text-xs text-slate-400">
            AstraPulse · Nova Retail Group · HR, Payroll & Finance platform
          </div>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {BOTTOM_NAV.map((item) => {
          const active = item.href !== "" && pathname.startsWith(item.href);
          const Icon = item.icon;
          if (!item.href) {
            return (
              <button
                key={item.label}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  "text-slate-500 active:text-brand-600"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-brand-600" : "text-slate-500 active:text-brand-600"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand-600")} />
              {item.label}
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-600" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}