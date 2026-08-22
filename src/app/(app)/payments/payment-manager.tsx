"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { recordPaymentAction, reconcilePaymentAction } from "./actions";

export function PaymentManager({
  rows,
  invoices,
  expenses,
  stats,
}: {
  rows: SmartRow[];
  invoices: { id: string; label: string }[];
  expenses: { id: string; label: string }[];
  stats: { incoming: number; outgoing: number; reconciled: number };
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState("in");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "reference", header: "Reference", minWidth: 110 },
    { key: "date", header: "Date", kind: "date" },
    { key: "direction", header: "Direction", kind: "badge" },
    { key: "party", header: "Counterparty" },
    { key: "method", header: "Method" },
    { key: "amount", header: "Amount", kind: "money" },
    { key: "reconciled", header: "Reconciled", kind: "boolean" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await recordPaymentAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Recorded", type: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function reconcile(id: string) {
    const res = await reconcilePaymentAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm sm:gap-6">
          <div>
            <p className="text-lg font-bold text-emerald-600">{stats.incoming.toLocaleString("en-US", { style: "currency", currency: "NPR" })}</p>
            <p className="text-xs text-slate-500">Incoming</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{stats.outgoing.toLocaleString("en-US", { style: "currency", currency: "NPR" })}</p>
            <p className="text-xs text-slate-500">Outgoing</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.reconciled}</p>
            <p className="text-xs text-slate-500">Reconciled</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record payment
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["reference", "party", "method", "notes"]}
        searchPlaceholder="Search payments..."
        filters={[{ key: "direction", label: "Direction", options: ["in", "out"].map((s) => ({ value: s, label: s })) }]}
        rowActions={[
          {
            label: "Reconcile",
            icon: <CheckCircle2 className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.reconciled === false,
            onClick: (r) => reconcile(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Record payment" description="Record an incoming or outgoing payment" size="lg">
        <form action={submit} className="space-y-4">
          <Select label="Direction" name="direction" value={direction} onChange={(v) => setDirection(v.target.value)}>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" name="amount" type="number" step="0.01" min="0.01" required error={errors.amount} />
            <Input label="Date" name="date" type="date" required error={errors.date} defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <Select label="Method" name="method" required>
            <option value="bank_transfer">Bank transfer</option>
            <option value="credit_card">Credit card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
          </Select>
          {direction === "in" && (
            <Select label="Invoice" name="invoiceId">
              <option value="">—</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </Select>
          )}
          {direction === "out" && (
            <Select label="Expense" name="expenseId">
              <option value="">—</option>
              {expenses.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </Select>
          )}
          <Textarea label="Notes" name="notes" rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}