import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

export function StatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  iconClass,
  tooltip,
  loading,
  footer,
  className,
}: {
  title: string;
  value: string | number;
  change?: number;
  trend?: "up" | "down" | "flat";
  icon?: LucideIcon;
  iconClass?: string;
  tooltip?: string;
  loading?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-500";

  return (
    <Card className={cn("relative overflow-hidden p-4 transition hover:shadow-md", className)}>
      {loading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-500" title={tooltip}>
                {title}
              </p>
              <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            </div>
            {Icon && (
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500",
                  iconClass
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            )}
          </div>
          {(change !== undefined || trend) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {trend && <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />}
              <span className={cn("font-medium", trendColor)}>
                {change !== undefined ? `${Math.abs(change).toFixed(1)}%` : ""}
              </span>
              <span className="text-slate-400">vs previous period</span>
            </div>
          )}
          {footer}
        </>
      )}
    </Card>
  );
}