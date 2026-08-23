"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CalendarCheck, Wallet, Menu, Sparkles, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, MobileDrawer } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { NotificationsPopover, type Notif } from "./notifications";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const BOTTOM_NAV_BASE = [
  { label: "Home", href: "/", icon: Home },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Menu", href: "", icon: Menu },
];

const BOTTOM_NAV_ADMIN = [
  { label: "Staff", href: "/staff", icon: Users, module: "staff" },
  { label: "Payroll", href: "/payroll", icon: Wallet, module: "payroll" },
];

function hasNavPermission(permissions: string[] | undefined, module: string): boolean {
  if (!permissions) return false;
  return (
    permissions.includes("*") ||
    permissions.includes(`${module}:*`) ||
    permissions.includes(`${module}:view`) ||
    permissions.includes(module)
  );
}

export function AppShell({
  user,
  workspace,
  permissions,
  showSubscription,
  notifications,
  unreadCount,
  unreadMessageCount,
  children,
}: {
  user: { name: string; email: string; role?: string; onLogout: () => Promise<{ ok: boolean }> };
  workspace: { name: string; plan?: string; status?: string };
  permissions?: string[];
  showSubscription?: boolean;
  notifications: Notif[];
  unreadCount: number;
  unreadMessageCount?: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        workspaceName={workspace.name}
        workspacePlan={workspace.plan}
        unreadCount={unreadCount}
        permissions={permissions}
        showSubscription={showSubscription}
      />
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        workspaceName={workspace.name}
        workspacePlan={workspace.plan}
        unreadCount={unreadCount}
        permissions={permissions}
      />

      <div className={cn("flex min-h-screen flex-col transition-all duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]")}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90 sm:h-16 lg:px-6">
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
            <ThemeToggle />
            <Link
              href="/mail"
              className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              title="Internal Mail"
            >
              <Mail className="h-5 w-5" />
              {(unreadMessageCount ?? 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadMessageCount}
                </span>
              )}
            </Link>
            <NotificationsPopover notifications={notifications} unread={unreadCount} />
            <UserMenu name={user.name} email={user.email} role={user.role} onLogout={user.onLogout} />
          </div>
        </header>

        <main className="flex-1 px-3 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-4 sm:pt-6 lg:px-8 lg:pb-6">{children}</main>

        <footer className="hidden lg:block">
          <div className="border-t border-slate-200 px-8 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            AstraPulse · HR, Payroll & Finance platform
          </div>
        </footer>
      </div>

      {(() => {
        const navItems = [
          ...BOTTOM_NAV_BASE,
          ...BOTTOM_NAV_ADMIN.filter((i) => hasNavPermission(permissions, i.module)),
        ];
        const navCount = navItems.length;
        return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-800 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${navCount}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const active = item.href !== "" && pathname.startsWith(item.href);
          const Icon = item.icon;
          if (!item.href) {
            return (
              <button
                key={item.label}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className={cn(
                  "relative flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
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
                "relative flex min-h-[44px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-500 active:text-brand-600 dark:text-slate-400 dark:active:text-brand-400"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand-600 dark:text-brand-400")} />
              {item.label}
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-600" />}
            </Link>
          );
        })}
      </nav>
      );
      })()}
    </div>
  );
}