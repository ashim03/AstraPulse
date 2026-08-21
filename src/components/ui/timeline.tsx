import type { ReactNode } from "react";
import Link from "next/link";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "./avatar";

export type ActivityItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: Date | string | null;
  actor?: { name: string; avatar?: string | null };
  icon?: ReactNode;
  tone?: "indigo" | "green" | "amber" | "red" | "sky" | "gray";
  href?: string;
};

const tones = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  gray: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

export function Timeline({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="relative space-y-0">
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span className="absolute left-[17px] top-9 h-full w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          )}
          <div
            className={cn(
              "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-800",
              tones[item.tone ?? "gray"]
            )}
          >
            {item.icon ?? (
              <Avatar name={item.actor?.name ?? "System"} size="sm" className="ring-0" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            {item.href ? (
              <Link href={item.href} className="block rounded-md -m-1 p-1 transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="text-sm text-slate-800 dark:text-slate-200">{item.title}</div>
                {item.description && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.description}</div>}
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  {item.actor && <span className="font-medium text-slate-500 dark:text-slate-400">{item.actor.name}</span>}
                  {item.timestamp && <span>{timeAgo(item.timestamp)}</span>}
                </div>
              </Link>
            ) : (
              <>
                <div className="text-sm text-slate-800 dark:text-slate-200">{item.title}</div>
                {item.description && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.description}</div>}
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  {item.actor && <span className="font-medium text-slate-500 dark:text-slate-400">{item.actor.name}</span>}
                  {item.timestamp && <span>{timeAgo(item.timestamp)}</span>}
                </div>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <div className={cn("px-5 py-4", className)}>
      <Timeline items={items} />
    </div>
  );
}