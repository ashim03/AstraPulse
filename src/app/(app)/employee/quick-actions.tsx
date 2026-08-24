"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Coffee, FileEdit, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  clockInAction,
  clockOutAction,
  startBreakAction,
  endBreakAction,
} from "@/app/(app)/attendance/actions";

export function EmployeeQuickActions({
  hasClockedIn,
  hasClockedOut,
  breakActive,
}: {
  hasClockedIn: boolean;
  hasClockedOut: boolean;
  breakActive: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: string) {
    setLoading(action);
    try {
      let res;
      switch (action) {
        case "clock-in":
          res = await clockInAction();
          break;
        case "clock-out":
          res = await clockOutAction();
          break;
        case "start-break":
          res = await startBreakAction();
          break;
        case "end-break":
          res = await endBreakAction();
          break;
      }
      if (res?.ok) {
        toast({ title: res.message ?? "Done", type: "success" });
      } else if (res) {
        toast({ title: res.error, type: "error" });
      }
      router.refresh();
    } catch {
      toast({ title: "Something went wrong", type: "error" });
    }
    setLoading(null);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        leftIcon={<Clock className="h-4 w-4" />}
        onClick={() => handleAction("clock-in")}
        loading={loading === "clock-in"}
        disabled={hasClockedIn}
      >
        Clock In
      </Button>
      <Button
        variant="secondary"
        leftIcon={<Clock className="h-4 w-4" />}
        onClick={() => handleAction("clock-out")}
        loading={loading === "clock-out"}
        disabled={!hasClockedIn || hasClockedOut}
      >
        Clock Out
      </Button>
      <Button
        variant="secondary"
        leftIcon={<Coffee className="h-4 w-4" />}
        onClick={() => handleAction(breakActive ? "end-break" : "start-break")}
        loading={loading === "start-break" || loading === "end-break"}
        disabled={!hasClockedIn || hasClockedOut}
      >
        {breakActive ? "End Break" : "Start Break"}
      </Button>
      <Button
        variant="outline"
        leftIcon={<FileEdit className="h-4 w-4" />}
        onClick={() => router.push("/employee/requests")}
      >
        Submit Correction
      </Button>
      <Button
        variant="outline"
        leftIcon={<CalendarDays className="h-4 w-4" />}
        onClick={() => router.push("/employee/requests")}
      >
        Submit Leave
      </Button>
    </div>
  );
}
