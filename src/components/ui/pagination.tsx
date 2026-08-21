"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }

  const btn = (disabled: boolean, onClick: () => void, children: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white dark:bg-slate-800 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        {btn(page === 1, () => onPageChange(1), <ChevronsLeft className="h-4 w-4" />, "First page")}
        {btn(page === 1, () => onPageChange(page - 1), <ChevronLeft className="h-4 w-4" />, "Previous page")}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-1 text-sm text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium transition",
                p === page ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {p}
            </button>
          )
        )}
        {btn(page === pageCount, () => onPageChange(page + 1), <ChevronRight className="h-4 w-4" />, "Next page")}
        {btn(page === pageCount, () => onPageChange(pageCount), <ChevronsRight className="h-4 w-4" />, "Last page")}
      </div>
    </div>
  );
}