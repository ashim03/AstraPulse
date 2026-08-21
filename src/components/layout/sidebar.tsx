"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ChevronsUpDown, Sparkles, Zap, Building2, HelpCircle, X } from "lucide-react";
import { NAVIGATION, NAV_SECTIONS, PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";

export function WorkspaceSwitcher({ name, plan, collapsed }: { name: string; plan?: string; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <Dropdown
      width="w-64"
      trigger={
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            {name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{name}</span>
            <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
              {plan ?? "Free"} plan
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      }
    >
      <div className="px-3.5 py-2">
        <p className="text-xs font-medium text-slate-500">Current workspace</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{name}</p>
      </div>
      <DropdownSeparator />
      <div className="px-3.5 py-2 text-xs text-slate-500">
        This workspace is the only one in this demo. Invite teammates to collaborate.
      </div>
      <DropdownSeparator />
      <DropdownItem icon={<Sparkles className="h-4 w-4" />} onClick={() => { window.location.href = "/subscription"; }}>Upgrade workspace</DropdownItem>
      <DropdownItem icon={<Building2 className="h-4 w-4" />} onClick={() => { window.location.href = "/subscription"; }}>Create new workspace</DropdownItem>
    </Dropdown>
  );
}

export function SidebarLink({ href, label, icon: Icon, collapsed, onNavigate }: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
        collapsed && "justify-center px-2"
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />}
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  workspaceName,
  workspacePlan,
  onNavigate,
  unreadCount,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  workspaceName: string;
  workspacePlan?: string;
  onNavigate?: () => void;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const plan = PLANS.find((p) => p.name === workspacePlan);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex dark:border-slate-700 dark:bg-slate-800",
        collapsed ? "w-[68px]" : "w-[248px]"
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-100 px-4 dark:border-slate-700", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">AstraPulse</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">HR · Payroll · Finance</p>
            </div>
          </Link>
        )}
      </div>

      <div className={cn("shrink-0 px-3 pt-3", collapsed && "px-2")}>
        <WorkspaceSwitcher name={workspaceName} plan={workspacePlan} collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-thin">
        {Object.values(NAV_SECTIONS).map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {NAVIGATION.filter((item) => section.items.includes(item.label)).map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="shrink-0 p-3">
          <div className="rounded-card border border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 p-4">
            {plan && (
              <>
                <div className="flex items-center justify-between">
                  <Badge tone={plan.name === "Pro" ? "violet" : plan.name === "Growth" ? "indigo" : "gray"}>
                    {plan.name}
                  </Badge>
                  <Sparkles className="h-4 w-4 text-brand-500" />
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-800">{workspacePlan} workspace</p>
                <p className="mt-0.5 text-xs text-slate-500">{plan.employeeLimit} employees included</p>
                <Link
                  href="/subscription"
                  className="mt-3 block rounded-lg bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  Manage subscription
                </Link>
              </>
            )}
            {!plan && (
              <Link href="/subscription" className="flex items-center gap-2 text-sm font-medium text-brand-700">
                <Sparkles className="h-4 w-4" /> Choose a plan
              </Link>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => onCollapsedChange(!collapsed)}
        className={cn(
          "flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200",
          collapsed && "justify-center px-0"
        )}
      >
        <ChevronsUpDown className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
        {!collapsed && "Collapse sidebar"}
      </button>
    </aside>
  );
}

export function MobileDrawer({
  open,
  onClose,
  workspaceName,
  workspacePlan,
  unreadCount,
}: {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  workspacePlan?: string;
  unreadCount?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[288px] flex-col bg-white dark:bg-slate-800 shadow-modal animate-fade-in">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
              <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">AstraPulse</p>
          </Link>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="shrink-0 px-3 pt-3">
          <WorkspaceSwitcher name={workspaceName} plan={workspacePlan} />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-thin">
          {Object.values(NAV_SECTIONS).map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {NAVIGATION.filter((item) => section.items.includes(item.label)).map((item) => (
                  <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} onNavigate={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}