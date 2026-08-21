"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { runPayrollAction } from "./actions";

export function PayrollManager({ rows, latestPeriod }: { rows: SmartRow[]; latestPeriod: string }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(latestPeriod);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "period", header: "Period", minWidth: 140 },
    { key: "employees", header: "Employees", kind: "number" },
    { key: "grossTotal", header: "Gross", kind: "money" },
    { key: "deductionTotal", header: "Deductions", kind: "money" },
    { key: "taxTotal", header: "Tax", kind: "money" },
    { key: "netTotal", header: "Net", kind: "money" },
    { key: "status", header: "Status", kind: "status" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await runPayrollAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Created", type: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Payroll runs are calculated from active employees, salary components, and outstanding advances.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Run payroll
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["period", "name"]}
        searchPlaceholder="Search payroll runs..."
        filters={[{ key: "status", label: "Status", options: ["draft", "calculated", "approved", "processed", "paid", "locked"].map((s) => ({ value: s, label: s })) }]}
        rowHrefPrefix="/payroll"
        rowActions={[
          {
            label: "Open",
            icon: <ArrowRight className="h-4 w-4" />,
            tone: "neutral",
            onClick: (r) => router.push(`/payroll/${String(r.id)}`),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Run payroll" description="Generate a payroll run for a period (YYYY-MM)" size="sm">
        <form action={submit} className="space-y-4">
          <Input label="Period" name="period" value={period} onChange={(v) => setPeriod(v.target.value)} error={errors.period} placeholder="e.g. 2026-08" required />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Generate</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}