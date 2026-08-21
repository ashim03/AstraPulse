"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

function toDateInputValue(d?: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInputValue(v: string): Date | null {
  if (!v) return null;
  const [y, m, day] = v.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  min,
  max,
}: {
  value?: Date | null;
  onChange?: (d: Date | null) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        type="date"
        value={toDateInputValue(value)}
        min={min}
        max={max}
        onChange={(e) => onChange?.(fromDateInputValue(e.target.value))}
        className="pr-9"
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: {
  from?: Date | null;
  to?: Date | null;
  onFromChange?: (d: Date | null) => void;
  onToChange?: (d: Date | null) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DatePicker value={from} onChange={onFromChange} placeholder="From" />
      <span className="text-slate-400">–</span>
      <DatePicker value={to} onChange={onToChange} placeholder="To" min={from ? toDateInputValue(from) : undefined} />
    </div>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}