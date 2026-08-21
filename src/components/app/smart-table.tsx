"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { money, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toneFor } from "@/lib/constants";

export type SmartColumn = {
  key: string;
  header: string;
  kind?: "text" | "money" | "number" | "date" | "datetime" | "status" | "avatar" | "badge" | "link" | "boolean";
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  minWidth?: number;
  exportable?: boolean;
  badgeMap?: Record<string, { label: string; tone?: BadgeTone }>;
  badgeFallback?: string;
  hrefPrefix?: string;
  avatarSubKey?: string;
  booleanTrue?: string;
  booleanFalse?: string;
};

export type SmartRow = Record<string, unknown>;

export function SmartTable({
  rows,
  columns,
  rowKey = "id",
  searchKeys,
  searchPlaceholder = "Search...",
  filters,
  filtersValue,
  onFiltersChange,
  rowHrefPrefix,
  emptyTitle = "No records found",
  emptyDescription = "Get started by creating your first record.",
  toolbar,
  pageSize,
  exportFilename = "export.csv",
  selected,
  onSelectionChange,
  bulkActions,
  loading,
  compact,
  showToolbar = true,
  rowActions,
}: {
  rows: SmartRow[];
  columns: SmartColumn[];
  rowKey?: string;
  searchKeys?: string[];
  searchPlaceholder?: string;
  filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
  filtersValue?: Record<string, string>;
  onFiltersChange?: (key: string, value: string) => void;
  rowHrefPrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
  pageSize?: number;
  exportFilename?: string;
  selected?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  bulkActions?: Array<{ label: string; icon?: React.ReactNode; onClick: (rows: SmartRow[]) => void; danger?: boolean }>;
  loading?: boolean;
  compact?: boolean;
  showToolbar?: boolean;
  rowActions?: Array<{
    label: string;
    icon: React.ReactNode;
    tone?: "danger" | "success" | "warning" | "neutral";
    show?: (row: SmartRow) => boolean;
    onClick: (row: SmartRow) => void;
  }>;
}) {
  const cols: Column<SmartRow>[] = columns.map((c) => {
    const sortable = c.sortable ?? true;
    return {
      key: c.key,
      header: c.header,
      sortable,
      align: c.align,
      className: c.className,
      minWidth: c.minWidth,
      sortValue: sortable ? (r) => String(r[c.key] ?? "") : undefined,
      exportValue: c.exportable === false ? undefined : (r) => {
        const v = r[c.key];
        if (c.kind === "money") return typeof v === "number" ? v : 0;
        if (c.kind === "date" || c.kind === "datetime") return typeof v === "string" ? v : "";
        return String(v ?? "");
      },
      cell: (r) => renderCell(r, c),
    };
  });

  if (rowActions?.length) {
    cols.push({
      key: "__actions",
      header: "",
      sortable: false,
      exportValue: undefined,
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {rowActions
            .filter((a) => !a.show || a.show(r))
            .map((a) => (
              <button
                key={a.label}
                title={a.label}
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick(r);
                }}
                className={cn(
                  "rounded-md p-1.5 transition",
                  a.tone === "danger"
                    ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                    : a.tone === "success"
                      ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                      : a.tone === "warning"
                        ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {a.icon}
              </button>
            ))}
        </div>
      ),
    });
  }

  const searchable = (r: SmartRow) =>
    (searchKeys ?? []).map((k) => String(r[k] ?? "")).join(" ") + " " + JSON.stringify(r);

  const activeFilters: FilterDef<SmartRow>[] | undefined = filters
    ? filters.map((f) => ({
        key: f.key,
        label: f.label,
        options: f.options,
        value: filtersValue?.[f.key] ?? "",
        onChange: (v) => onFiltersChange?.(f.key, v),
      }))
    : undefined;

  const filtered = useRows(rows, activeFilters ? activeFilters.map((f) => ({ key: f.key, value: f.value })) : []);

  return (
    <DataTable
      data={filtered}
      columns={cols}
      rowKey={(r) => String(r[rowKey])}
      searchKeys={searchKeys?.length ? searchable : undefined}
      searchPlaceholder={searchPlaceholder}
      filters={activeFilters}
      onRowClick={rowHrefPrefix ? (r) => {
        const id = String(r[rowKey]);
        window.location.href = `${rowHrefPrefix}${id}`;
      } : undefined}
      toolbar={toolbar}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      pageSize={pageSize}
      exportFilename={exportFilename}
      selected={selected}
      onSelectionChange={onSelectionChange}
      bulkActions={bulkActions}
      loading={loading}
      compact={compact}
      showToolbar={showToolbar}
    />
  );
}

function renderCell(r: SmartRow, c: SmartColumn) {
  const raw = r[c.key];
  switch (c.kind) {
    case "money":
      return <span className="font-medium tabular-nums text-slate-800">{money(typeof raw === "number" ? raw : Number(raw ?? 0))}</span>;
    case "number":
      return <span className="tabular-nums text-slate-700">{Number(raw ?? 0).toLocaleString()}</span>;
    case "date":
      return <span className="text-slate-500">{formatDate(typeof raw === "string" ? raw : undefined)}</span>;
    case "datetime":
      return <span className="text-slate-500">{formatDateTime(typeof raw === "string" ? raw : undefined)}</span>;
    case "status":
      return <StatusBadge status={String(raw ?? "")} />;
    case "badge": {
      const key = String(raw ?? "");
      const opt = c.badgeMap?.[key];
      if (opt) return <Badge tone={opt.tone}>{opt.label}</Badge>;
      return <Badge>{c.badgeFallback ?? (key || "—")}</Badge>;
    }
    case "avatar": {
      const name = String(raw ?? "");
      const sub = c.avatarSubKey ? String(r[c.avatarSubKey] ?? "") : undefined;
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{name}</p>
            {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
          </div>
        </div>
      );
    }
    case "link": {
      const id = String(r["id"] ?? raw ?? "");
      return (
        <Link href={`${c.hrefPrefix ?? ""}${id}`} className="font-medium text-brand-700 hover:underline">
          {String(raw ?? "")}
        </Link>
      );
    }
    case "boolean": {
      const truthy = Boolean(raw);
      return truthy ? (
        <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
          <Check className="h-4 w-4" /> {c.booleanTrue ?? "Yes"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm text-slate-400">
          <X className="h-4 w-4" /> {c.booleanFalse ?? "No"}
        </span>
      );
    }
    default:
      return <span className="text-slate-700">{String(raw ?? "—")}</span>;
  }
}

import { useMemo } from "react";

function useRows(rows: SmartRow[], applied: Array<{ key: string; value: string }>) {
  return useMemo(() => {
    const active = applied.filter((f) => f.value);
    if (!active.length) return rows;
    return rows.filter((r) => active.every((f) => String(r[f.key]) === f.value));
  }, [rows, JSON.stringify(applied)]);
}