"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type CalendarDay = {
  date: Date;
  dot?: string;
  dotClass?: string;
  content?: React.ReactNode;
};

export function Calendar({
  days,
  selected,
  onSelect,
  month,
  onMonthChange,
  className,
  compact,
}: {
  days: CalendarDay[];
  selected?: Date | null;
  onSelect?: (d: Date) => void;
  month?: Date;
  onMonthChange?: (d: Date) => void;
  className?: string;
  compact?: boolean;
}) {
  const [internalMonth, setInternalMonth] = useState(() => startOfMonth(new Date()));
  const currentMonth = month ?? internalMonth;
  const setMonth = onMonthChange ?? setInternalMonth;

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(format(d.date, "yyyy-MM-dd"), d);
    return map;
  }, [days]);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {format(currentMonth, "MMMM yyyy")}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMonth(new Date())}
            className="px-2 text-xs font-medium"
          >
            Today
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {w}
          </div>
        ))}
        {grid.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const day = byDate.get(key);
          const inMonth = isSameMonth(date, currentMonth);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, new Date());
          return (
            <button
              key={key}
              onClick={() => onSelect?.(date)}
              disabled={!onSelect}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg py-2 sm:py-1.5 text-xs font-medium transition min-h-[44px]",
                inMonth ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" : "text-slate-300",
                isSelected && "bg-brand-600 text-white hover:bg-brand-600",
                !isSelected && isToday && "ring-1 ring-inset ring-brand-300"
              )}
            >
              <span>{date.getDate()}</span>
              {day?.dot && (
                <span
                  className={cn("mt-0.5 h-1 w-1 rounded-full", day.dotClass ?? "bg-brand-500")}
                  style={day.dotClass ? undefined : undefined}
                />
              )}
              {compact && day?.content && <span className="mt-0.5">{day.content}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}