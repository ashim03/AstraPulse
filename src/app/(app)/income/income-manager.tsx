"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { createIncomeAction, deleteIncomeAction } from "./actions";

export function IncomeManager({ rows }: { rows: SmartRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "number", header: "Number", minWidth: 110 },
    { key: "customer", header: "Customer" },
    { key: "category", header: "Category", kind: "badge" },
    { key: "date", header: "Date", kind: "date" },
    { key: "amount", header: "Amount", kind: "money" },
    { key: "tax", header: "Tax", kind: "money" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createIncomeAction(formData);
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

  async function remove(id: string) {
    const res = await deleteIncomeAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Record non-invoice revenue such as services, grants, and other income.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record income
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["number", "customer", "category", "description"]}
        searchPlaceholder="Search income..."
        filters={[{ key: "category", label: "Category", options: ["Services", "Products", "Grants", "Other"].map((s) => ({ value: s, label: s })) }]}
        rowActions={[
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            onClick: (r) => remove(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Record income" description="Log revenue received by the business" size="lg">
        <form action={submit} className="space-y-4">
          <Input label="Customer" name="customerName" placeholder="e.g. Acme Corp" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" name="category" required error={errors.category}>
              <option value="Services">Services</option>
              <option value="Products">Products</option>
              <option value="Grants">Grants</option>
              <option value="Other">Other</option>
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
          <Textarea label="Description" name="description" rows={3} placeholder="What was this income for?" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}