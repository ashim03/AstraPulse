import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/constants";
import { toneFor } from "@/lib/constants";

const tones: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
};

const dotTones: Record<BadgeTone, string> = {
  gray: "bg-slate-400",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
};

export function Badge({
  tone = "gray",
  dot = false,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge tone={toneFor(status)} dot className={className}>
      {label}
    </Badge>
  );
}

export { tones as badgeTones, dotTones as badgeDotTones };