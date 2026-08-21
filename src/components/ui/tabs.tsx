"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto border-b border-slate-200 scrollbar-thin", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabContent({ value, active, children }: { value: string; active: string; children: ReactNode }) {
  if (value !== active) return null;
  return <div className="animate-fade-in">{children}</div>;
}

export function useTabs(initial: string) {
  const [value, setValue] = useState(initial);
  return { value, setValue };
}