"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, Filter } from "lucide-react";
import { Input, Select } from "./input";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterBar({
  filters,
  onFilterChange,
  search,
  onSearch,
  searchPlaceholder = "Search...",
  children,
  className,
}: {
  filters: Array<{
    key: string;
    label: string;
    options: FilterOption[];
    value: string;
    placeholder?: string;
  }>;
  onFilterChange: (key: string, value: string) => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  className?: string;
}) {
  const activeCount = filters.filter((f) => f.value !== "").length;
  return (
    <div className={cn("flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", className)}>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">{f.label}</span>
              <Select
                value={f.value}
                onChange={(e) => onFilterChange(f.key, e.target.value)}
                className="h-9 w-auto min-w-[120px] py-1 text-xs"
              >
                <option value="">{f.placeholder ?? "All"}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          {activeCount > 0 && (
            <button
              onClick={() => filters.forEach((f) => onFilterChange(f.key, ""))}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              Clear {activeCount}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function useFilterState(keys: string[]) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  return {
    filters,
    setFilter: (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value })),
    clear: () => setFilters({}),
    isFiltered: keys.some((k) => filters[k] !== ""),
  };
}