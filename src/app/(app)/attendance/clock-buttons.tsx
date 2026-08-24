"use client";

import { useRouter } from "next/navigation";
import { FileEdit, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClockButtons({
  myRecord,
  hasEmployee,
}: {
  myRecord: { clockIn: boolean; clockOut: boolean; breakActive?: boolean; breakUsed?: boolean } | null;
  hasEmployee: boolean;
}) {
  const router = useRouter();

  if (!hasEmployee) return null;

  const clockedIn = myRecord?.clockIn && !myRecord.clockOut;
  const clockedOut = myRecord?.clockIn && myRecord.clockOut;

  return (
    <>
      {clockedOut && (
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          Clocked out ✓
        </span>
      )}
      {clockedIn && (
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          Clocked in ✓
        </span>
      )}
      {!myRecord?.clockIn && (
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
          Use attendance machine to clock in
        </span>
      )}
    </>
  );
}
