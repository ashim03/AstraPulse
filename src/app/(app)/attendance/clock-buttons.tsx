"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clockInAction, clockOutAction } from "./actions";

export function ClockButtons({
  myRecord,
  hasEmployee,
}: {
  myRecord: { clockIn: boolean; clockOut: boolean } | null;
  hasEmployee: boolean;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  if (!hasEmployee) return null;

  async function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    const res = await action();
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Done", type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error ?? "Something went wrong", type: "error" });
    }
  }

  const clockedIn = myRecord?.clockIn && !myRecord.clockOut;

  return (
    <>
      {!myRecord?.clockIn && (
        <Button size="sm" leftIcon={<LogIn className="h-4 w-4" />} disabled={pending} onClick={() => run(clockInAction)}>
          {pending ? "..." : "Clock In"}
        </Button>
      )}
      {clockedIn && (
        <Button variant="secondary" size="sm" leftIcon={<LogOut className="h-4 w-4" />} disabled={pending} onClick={() => run(clockOutAction)}>
          {pending ? "..." : "Clock Out"}
        </Button>
      )}
      {myRecord?.clockIn && myRecord.clockOut && (
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          Clocked out ✓
        </span>
      )}
    </>
  );
}