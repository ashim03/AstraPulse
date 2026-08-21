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
    <div className={cn("grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4", className)}>
      {columns.map((col) => (
        <div key={col.id} className="flex min-w-[260px] flex-col rounded-card bg-slate-100/70 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", `bg-${col.tone ?? "gray"}-400`)} />
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