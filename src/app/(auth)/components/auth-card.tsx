import type { ReactNode } from "react";
import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="card animate-fade-in p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">{footer}</div>}
    </div>
  );
}

export function AuthLogo() {
  return (
    <Link href="/login" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      </div>
      <p className="text-lg font-bold tracking-tight text-slate-900">AstraPulse</p>
    </Link>
  );
}

export function DemoAccounts() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3.5 text-xs">
      <p className="mb-2 font-semibold text-slate-600">Demo accounts (password: Admin@123)</p>
      <ul className="space-y-1 font-mono text-slate-500">
        <li>admin@nova.local — Workspace Admin</li>
        <li>hr@nova.local — HR Manager</li>
        <li>accountant@nova.local — Accountant</li>
        <li>payroll@nova.local — Payroll Manager</li>
        <li>employee@nova.local — Employee</li>
      </ul>
    </div>
  );
}