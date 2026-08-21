"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

export function AttendanceDayPicker({ selected }: { selected: string }) {
  const [value, setValue] = useState(selected);
  const router = useRouter();

  function apply(date: string) {
    setValue(date);
    router.push(`/attendance?date=${date}`);
  }

  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && apply(e.target.value)}
        className="input h-10 w-auto pl-9 pr-3 text-sm"
      />
    </div>
  );
}