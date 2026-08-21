"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { money } from "@/lib/utils";
import { createAdvanceAction, reviewAdvanceAction, deleteAdvanceAction } from "./actions";

export type EmployeeOption = { id: string; name: string };

export function AdvanceManager({
  rows,
  employees,
  totalOutstanding,
}: {
  rows: SmartRow[];
  employees: EmployeeOption[];
  totalOutstanding: number;
}) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(0);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const installment = amount > 0 && months > 0 ? amount / months : 0;

  const columns: SmartColumn[] = [
    { key: "employee", header: "Employee", kind: "avatar" },
    { key: "date", header: "Date", kind: "date" },
    { key: "amount", header: "Amount", kind: "money" },
    { key: "months", header: "Months", kind: "number" },
    { key: "installment", header: "Monthly", kind: "money" },
    { key: "outstanding", header: "Outstanding", kind: "money" },
    { key: "status", header: "Status", kind: "status" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createAdvanceAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Created", type: "success" });
      setOpen(false);
      setAmount(0);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function review(id: string, status: "approved" | "rejected") {
    const res = await reviewAdvanceAction(id, status);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteAdvanceAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{money(totalOutstanding)}</p>
          <p className="text-xs text-slate-500">Total outstanding advances</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Request advance
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["employee", "reason"]}
        searchPlaceholder="Search advances..."
        filters={[{ key: "status", label: "Status", options: ["pending", "approved", "rejected", "paid"].map((s) => ({ value: s, label: s })) }]}
        rowActions={[
          {
            label: "Approve",
            icon: <Check className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.status === "pending",
            onClick: (r) => review(String(r.id), "approved"),
          },
          {
            label: "Reject",
            icon: <X className="h-4 w-4" />,
            tone: "danger",
            show: (r) => r.status === "pending",
            onClick: (r) => review(String(r.id), "rejected"),
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            onClick: (r) => remove(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Request advance" description="A salary advance recovered via monthly installments" size="lg">
        <form action={submit} className="space-y-4">
          <Select label="Employee" name="employeeId" required error={errors.employeeId}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" name="amount" type="number" step="0.01" min="1" required error={errors.amount} onChange={(v) => setAmount(Number(v.target.value))} />
            <Input label="Date" name="date" type="date" required error={errors.date} defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Months" name="months" type="number" min="1" max="24" required error={errors.months} defaultValue={1} onChange={(v) => setMonths(Number(v.target.value))} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Monthly installment: </span>
              <span className="font-semibold text-slate-800">{money(installment)}</span>
            </div>
          </div>
          <Textarea label="Reason" name="reason" rows={3} placeholder="Optional reason for the advance" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}