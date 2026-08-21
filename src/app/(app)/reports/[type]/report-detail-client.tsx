"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { REPORT_PERIODS } from "@/lib/constants";

export function ReportDetailClient({ period }: { period: string }) {
  const router = useRouter();
  return (
    <Select
      defaultValue={period}
      onChange={(e) => {
        const params = new URLSearchParams(window.location.search);
        params.set("period", e.target.value);
        router.push(`?${params.toString()}`);
      }}
    >
      {REPORT_PERIODS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </Select>
  );
}