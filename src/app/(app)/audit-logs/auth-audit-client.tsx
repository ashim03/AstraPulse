"use client";

import { useState, useMemo } from "react";
import { Download, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/constants";

type AuthLog = {
  id: string;
  email: string;
  action: string;
  success: boolean;
  ip: string | null;
  metadata: string | null;
  createdAt: string;
};

const ACTION_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  register: { label: "Register", tone: "blue" },
  verify_email: { label: "Verify Email", tone: "green" },
  login: { label: "Login", tone: "indigo" },
  login_otp: { label: "Login OTP", tone: "violet" },
  forgot_password: { label: "Forgot Password", tone: "amber" },
  reset_password: { label: "Reset Password", tone: "green" },
  change_password: { label: "Change Password", tone: "sky" },
  admin_verify: { label: "Admin Verify", tone: "rose" },
  admin_disable: { label: "Admin Disable", tone: "rose" },
  admin_force_reset: { label: "Admin Force Reset", tone: "rose" },
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "register", label: "Register" },
  { value: "verify_email", label: "Verify Email" },
  { value: "login", label: "Login" },
  { value: "login_otp", label: "Login OTP" },
  { value: "forgot_password", label: "Forgot Password" },
  { value: "reset_password", label: "Reset Password" },
  { value: "change_password", label: "Change Password" },
  { value: "admin_verify", label: "Admin Verify" },
  { value: "admin_disable", label: "Admin Disable" },
  { value: "admin_force_reset", label: "Admin Force Reset" },
];

export function AuthAuditClient({ logs: initialLogs }: { logs: AuthLog[] }) {
  const [actionFilter, setActionFilter] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filtered = useMemo(() => {
    let result = initialLogs;
    if (actionFilter) {
      result = result.filter((l) => l.action === actionFilter);
    }
    if (emailSearch) {
      const q = emailSearch.toLowerCase();
      result = result.filter((l) => l.email.toLowerCase().includes(q));
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((l) => new Date(l.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.createdAt) <= to);
    }
    return result;
  }, [initialLogs, actionFilter, emailSearch, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const headers = ["Timestamp", "Email", "Action", "Status", "IP", "Details"];
    const rows = filtered.map((l) => [
      l.createdAt,
      l.email,
      l.action,
      l.success ? "success" : "fail",
      l.ip ?? "",
      l.metadata ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auth-audit-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "min-h-[44px] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <Card>
      <CardHeader
        title="Authentication Audit Logs"
        subtitle={filtered.length + " entries"}
        action={
          <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search by email..."
            value={emailSearch}
            onChange={(e) => { setEmailSearch(e.target.value); setPage(1); }}
            className={inputClass}
          />
          <Select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className={inputClass}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Input
            type="date"
            placeholder="From"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className={inputClass}
          />
          <Input
            type="date"
            placeholder="To"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className={inputClass}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No auth audit logs found
                  </td>
                </tr>
              ) : (
                paged.map((log) => {
                  const actionBadge = ACTION_BADGE[log.action] || { label: log.action, tone: "gray" as BadgeTone };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                        {log.email}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge tone={actionBadge.tone}>{actionBadge.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-4 w-4" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {log.ip ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                        {log.metadata ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm text-slate-600 dark:text-slate-300">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
