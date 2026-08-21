"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { updatePayrollStatusAction } from "../actions";

export function PayrollDetailManager({
  payrollId,
  status,
  period,
  rows,
}: {
  payrollId: string;
  status: string;
  period: string;
  rows: SmartRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "employee", header: "Employee", kind: "avatar" },
    { key: "position", header: "Position" },
    { key: "gross", header: "Gross", kind: "money" },
    { key: "deductions", header: "Deductions", kind: "money" },
    { key: "tax", header: "Tax", kind: "money" },
    { key: "advanceDeduction", header: "Advance", kind: "money" },
    { key: "net", header: "Net", kind: "money" },
    { key: "paymentStatus", header: "Payment", kind: "status" },
  ];

  async function setStatus(next: string) {
    const res = await updatePayrollStatusAction(payrollId, next);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  const locked = status === "locked";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Payslips</h2>
        <div className="flex gap-2">
          {status === "calculated" && (
            <Button variant="outline" onClick={() => setStatus("review")}>Send to review</Button>
          )}
          {status === "review" && (
            <Button onClick={() => setStatus("approved")}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          )}
          {status === "approved" && (
            <Button onClick={() => setStatus("paid")}>
              <CheckCircle2 className="h-4 w-4" /> Mark paid
            </Button>
          )}
          {status === "paid" && !locked && (
            <Button variant="outline" onClick={() => setStatus("locked")}>
              <Lock className="h-4 w-4" /> Lock
            </Button>
          )}
        </div>
      </div>

      <SmartTable rows={rows} columns={columns} rowKey="id" searchKeys={["employee", "position"]} searchPlaceholder="Search payslips..." />
    </div>
  );
}