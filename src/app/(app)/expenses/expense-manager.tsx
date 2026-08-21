"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { createExpenseAction, updateExpenseStatusAction, deleteExpenseAction } from "./actions";

export function ExpenseManager({ rows }: { rows: SmartRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "number", header: "Number", minWidth: 110 },
    { key: "vendor", header: "Vendor" },
    { key: "category", header: "Category", kind: "badge" },
    { key: "date", header: "Date", kind: "date" },
    { key: "amount", header: "Amount", kind: "money" },
    { key: "tax", header: "Tax", kind: "money" },
    { key: "status", header: "Status", kind: "status" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createExpenseAction(formData);
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

  async function setStatus(id: string, status: "approved" | "paid" | "rejected") {
    const res = await updateExpenseStatusAction(id, status);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteExpenseAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Track submitted, approved, and paid company expenses.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New expense
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["number", "vendor", "category", "description"]}
        searchPlaceholder="Search expenses..."
        filters={[{ key: "status", label: "Status", options: ["submitted", "approved", "paid", "rejected"].map((s) => ({ value: s, label: s })) }]}
        rowActions={[
          {
            label: "Approve",
            icon: <Check className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.status === "submitted",
            onClick: (r) => setStatus(String(r.id), "approved"),
          },
          {
            label: "Mark paid",
            icon: <Check className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.status === "approved",
            onClick: (r) => setStatus(String(r.id), "paid"),
          },
          {
            label: "Reject",
            icon: <X className="h-4 w-4" />,
            tone: "danger",
            show: (r) => r.status === "submitted",
            onClick: (r) => setStatus(String(r.id), "rejected"),
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            onClick: (r) => remove(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New expense" description="Submit an expense for approval and reimbursement" size="lg">
        <form action={submit} className="space-y-4">
          <Input label="Vendor" name="vendorName" placeholder="e.g. Adobe Inc." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" name="category" required error={errors.category}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Input label="Date" name="date" type="date" required error={errors.date} defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" name="amount" type="number" step="0.01" min="0.01" required error={errors.amount} />
            <Input label="Tax" name="tax" type="number" step="0.01" min="0" defaultValue={0} />
          </div>
          <Select label="Payment method" name="paymentMethod">
            <option value="">—</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="credit_card">Credit card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
          </Select>
          <Textarea label="Description" name="description" rows={3} placeholder="What was this for?" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}