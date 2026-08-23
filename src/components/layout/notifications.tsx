"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { cn, timeAgo } from "@/lib/utils";

export type Notif = {
  id: string;
  title: string;
  body?: string | null;
  type: string;
  link?: string | null;
  readAt?: Date | null;
  createdAt: Date;
};

export function NotificationsPopover({ notifications, unread }: { notifications: Notif[]; unread: number }) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);

  const markAllRead = async () => {
    await fetch("/api/notifications/read", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    router.refresh();
  };

  const openNotif = (n: Notif) => {
    if (!n.readAt) {
      fetch("/api/notifications/read-one", { method: "POST", body: JSON.stringify({ id: n.id }) });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date() } : x)));
    }
    if (n.link) router.push(n.link);
  };

  return (
    <Dropdown
      width="w-full max-w-96"
      trigger={
        <button className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">You&apos;re all caught up.</p>
        )}
        {items.slice(0, 8).map((n) => (
          <button
            key={n.id}
            onClick={() => openNotif(n)}
            className={cn(
              "flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/50",
              !n.readAt && "bg-brand-50/40 dark:bg-brand-900/20"
            )}
          >
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                n.type === "error" ? "bg-red-500" : n.type === "warning" ? "bg-amber-500" : "bg-brand-500",
                n.readAt && "bg-slate-200 dark:bg-slate-600"
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</span>
              {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</span>}
              <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </Dropdown>
  );
}