"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2, Eye, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { createInvoiceAction, updateInvoiceStatusAction, deleteInvoiceAction } from "./actions";

export type CustomerOption = { id: string; name: string };

export function InvoiceManager({ rows, customers }: { rows: SmartRow[]; customers: CustomerOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "number", header: "Number", minWidth: 110 },
    { key: "customer", header: "Customer" },
    { key: "date", header: "Date", kind: "date" },
    { key: "dueDate", header: "Due", kind: "date" },
    { key: "total", header: "Total", kind: "money" },
    { key: "paid", header: "Paid", kind: "money" },
    { key: "status", header: "Status", kind: "status" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createInvoiceAction(formData);
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

  async function setStatus(id: string, status: string) {
    const res = await updateInvoiceStatusAction(id, status);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteInvoiceAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Create, send, and track customer invoices.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New invoice
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["number", "customer", "notes"]}
        searchPlaceholder="Search invoices..."
        filters={[{ key: "status", label: "Status", options: ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"].map((s) => ({ value: s, label: s })) }]}
        rowHrefPrefix="/invoices"
        rowActions={[
          {
            label: "Send",
            icon: <Send className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.status === "draft",
            onClick: (r) => setStatus(String(r.id), "sent"),
          },
          {
            label: "Open",
            icon: <Eye className="h-4 w-4" />,
            tone: "neutral",
            onClick: (r) => router.push(`/invoices/${String(r.id)}`),
          },
          {
            label: "Cancel",
            icon: <Ban className="h-4 w-4" />,
            tone: "danger",
            show: (r) => !["paid", "cancelled"].includes(String(r.status)),
            onClick: (r) => setStatus(String(r.id), "cancelled"),
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            show: (r) => r.status === "draft",
            onClick: (r) => remove(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New invoice" description="Create an invoice with a single line item" size="lg">
        <form action={submit} className="space-y-4">
          <Select label="Customer" name="customerId" required error={errors.customerId}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Invoice date" name="date" type="date" required error={errors.date} defaultValue={new Date().toISOString().slice(0, 10)} />
            <Input label="Due date" name="dueDate" type="date" required error={errors.dueDate} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Line item</p>
            <div className="space-y-3">
              <Input label="Description" name="lineDescription" required error={errors.lineDescription} placeholder="e.g. Consulting - August" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Qty" name="lineQuantity" type="number" min="1" required error={errors.lineQuantity} defaultValue={1} />
                <Input label="Unit price" name="lineUnitPrice" type="number" step="0.01" min="0" required error={errors.lineUnitPrice} />
                <Input label="Tax %" name="lineTax" type="number" step="0.01" min="0" defaultValue={0} />
              </div>
            </div>
          </div>
          <Input label="Discount" name="discount" type="number" step="0.01" min="0" defaultValue={0} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Terms" name="terms" placeholder="e.g. Net 30" />
            <Textarea label="Notes" name="notes" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}