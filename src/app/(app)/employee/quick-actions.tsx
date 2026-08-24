"use client";

import { useRouter } from "next/navigation";
import { FileEdit, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex flex-wrap gap-3">
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
