"use client";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Eye,
  EyeOff,
  Columns3,
  Download,
  Check,
} from "lucide-react";
import { cn, downloadCSV } from "@/lib/utils";
import { SearchInput } from "./search-input";
import { Pagination } from "./pagination";
import { EmptyState, NoSearchResults } from "./empty-state";
import { Skeleton } from "./skeleton";
import { Dropdown, DropdownItem, DropdownSeparator } from "./dropdown";
import { Button } from "./button";
import { Badge } from "./badge";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => string | number;
  hideable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  minWidth?: number;
};

export type FilterDef<T> = {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  search,
  onSearch,
  searchKeys,
  searchPlaceholder = "Search...",
  filters,
  pageSize = 10,
  loading,
  onRowClick,
  selected,
  onSelectionChange,
  bulkActions,
  exportFilename = "export.csv",
  onExport,
  toolbar,
  emptyTitle,
  emptyDescription,
  compact,
  className,
  showToolbar = true,
}: {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: string;
  onSearch?: (v: string) => void;
  searchKeys?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  pageSize?: number;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  bulkActions?: Array<{ label: string; icon?: ReactNode; onClick: (rows: T[]) => void; danger?: boolean }>;
  exportFilename?: string;
  onExport?: (rows: T[]) => void;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  compact?: boolean;
  className?: string;
  showToolbar?: boolean;
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key))
  );
  const [selectAll, setSelectAll] = useState(false);

  const activeSearch = onSearch !== undefined ? search ?? "" : internalSearch;
  const setActiveSearch = (v: string) => (onSearch ? onSearch(v) : setInternalSearch(v));

  const rowsWithSearch = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    if (!term) return data;
    if (searchKeys) return data.filter((row) => searchKeys(row).toLowerCase().includes(term));
    return data.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(term)
    );
  }, [data, activeSearch, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return rowsWithSearch;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return rowsWithSearch;
    return [...rowsWithSearch].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rowsWithSearch, sortKey, sortDir, columns]);

  const visibleCols = columns.filter((c) => visibleColumns.has(c.key));
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange || !selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!onSelectionChange || !selected) return;
    if (selectAll) {
      onSelectionChange(new Set());
      setSelectAll(false);
    } else {
      onSelectionChange(new Set(pageRows.map((r) => rowKey(r))));
      setSelectAll(true);
    }
  };

  const exportRows = () => {
    if (onExport) {
      onExport(sorted);
      return;
    }
    const rows = sorted.map((row) =>
      columns
        .filter((c) => c.exportValue)
        .map((c) => c.exportValue!(row))
    );
    const header = columns.filter((c) => c.exportValue).map((c) => String(c.header));
    downloadCSV(exportFilename, [header, ...rows]);
  };

  const allSelected = selected && selected.size > 0 && pageRows.every((r) => selected.has(rowKey(r)));

  return (
    <div className={cn("card overflow-hidden", className)}>
      {showToolbar && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={activeSearch}
              onChange={setActiveSearch}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 sm:w-72"
            />
            {filters && filters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500">{f.label}</span>
                    <select
                      value={f.value}
                      onChange={(e) => f.onChange(e.target.value)}
                      className="input h-9 w-auto py-1 pr-8 text-xs"
                    >
                      <option value="">All</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            <Button variant="secondary" size="sm" onClick={exportRows} leftIcon={<Download className="h-4 w-4" />}>
              Export
            </Button>
            <Dropdown
              trigger={
                <Button variant="secondary" size="sm" leftIcon={<Columns3 className="h-4 w-4" />}>
                  Columns
                </Button>
              }
            >
              {(close) => (
                <div className="max-h-80 overflow-y-auto p-1 scrollbar-thin">
                  {columns
                    .filter((c) => c.hideable !== false)
                    .map((c) => (
                      <button
                        key={c.key}
                        onClick={() => {
                          const next = new Set(visibleColumns);
                          if (next.has(c.key)) next.delete(c.key);
                          else next.add(c.key);
                          setVisibleColumns(next);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            visibleColumns.has(c.key) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-slate-500"
                          )}
                        >
                          {visibleColumns.has(c.key) && <Check className="h-3 w-3" />}
                        </span>
                        {c.header}
                      </button>
                    ))}
                </div>
              )}
            </Dropdown>
          </div>
        </div>
      )}

      {selected && selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-slate-100 bg-brand-50/60 px-4 py-2.5">
          <Badge tone="indigo">{selected.size} selected</Badge>
          {bulkActions?.map((a) => (
            <button
              key={a.label}
              onClick={() => a.onClick(data.filter((r) => selected.has(rowKey(r))))}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium hover:underline",
                a.danger ? "text-red-600" : "text-brand-700"
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="ml-auto text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-4">
          <Skeleton className="h-10 w-full" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-max border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-[0_1px_0_0] shadow-slate-200/60">
              <tr>
                {onSelectionChange && (
                  <th className="th w-10 px-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                      checked={allSelected ?? false}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                )}
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "th cursor-pointer select-none whitespace-nowrap",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                    style={{ minWidth: col.minWidth }}
                    onClick={() => col.sortable && toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable &&
                        (sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-brand-600" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const id = rowKey(row);
                const isSelected = selected?.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "group transition hover:bg-slate-50/70",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-brand-50/60"
                    )}
                  >
                    {onSelectionChange && (
                      <td className="td w-10 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                          checked={isSelected ?? false}
                          onChange={() => toggleRow(id)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "td whitespace-nowrap",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          compact && "py-2",
                          col.className
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && sorted.length === 0 && (
            activeSearch ? (
              <NoSearchResults query={activeSearch} />
            ) : (
              <EmptyState title={emptyTitle} description={emptyDescription} />
            )
          )}
        </div>
      )}

      <div className="border-t border-slate-100 px-4 py-3">
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={sorted.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

export { ChevronDown, Eye, EyeOff };