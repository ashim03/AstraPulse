"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export type KanbanColumn = {
  id: string;
  title: string;
  count?: number;
  tone?: "gray" | "blue" | "indigo" | "green" | "amber" | "red" | "violet" | "sky";
};

export function KanbanBoard({
  columns,
  children,
  className,
}: {
  columns: KanbanColumn[];
  children: (columnId: string) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 overflow-x-auto pb-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4", className)}>
      {columns.map((col) => (
        <div key={col.id} className="flex min-w-0 sm:min-w-[260px] flex-col rounded-card bg-slate-100/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", { "bg-slate-400 dark:bg-slate-500": !col.tone || col.tone === "gray", "bg-blue-400": col.tone === "blue", "bg-emerald-400": col.tone === "green", "bg-amber-400": col.tone === "amber", "bg-red-400": col.tone === "red", "bg-violet-400": col.tone === "violet", "bg-sky-400": col.tone === "sky", "bg-indigo-400": col.tone === "indigo" })} />
              <h4 className="text-sm font-semibold text-slate-800">{col.title}</h4>
            </div>
            {typeof col.count === "number" && <Badge tone="gray">{col.count}</Badge>}
          </div>
          <div className="space-y-2.5">{children(col.id)}</div>
        </div>
      ))}
    </div>
  );
}