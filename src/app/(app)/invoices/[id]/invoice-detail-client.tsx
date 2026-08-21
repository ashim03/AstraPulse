"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { money } from "@/lib/utils";
import { updateInvoiceStatusAction, recordInvoicePaymentAction } from "../actions";

export function InvoiceDetailClient({
  invoiceId,
  status,
  remaining,
  payments,
}: {
  invoiceId: string;
  status: string;
  remaining: number;
  payments: { id: string; reference: string; date: string; amount: number; method: string }[];
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function setStatus(next: string) {
    const res = await updateInvoiceStatusAction(invoiceId, next);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  async function pay(formData: FormData) {
    setPending(true);
    const res = await recordInvoicePaymentAction(invoiceId, formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Recorded", type: "success" });
      setPayOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && (
          <Button onClick={() => setStatus("sent")}>
            <Send className="h-4 w-4" /> Send invoice
          </Button>
        )}
        {remaining > 0 && !["cancelled"].includes(status) && (
          <Button variant="outline" onClick={() => setPayOpen(true)}>
            <Plus className="h-4 w-4" /> Record payment
          </Button>
        )}
        <Badge>{status}</Badge>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Payments</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Reference</th>
                <th className="py-2">Date</th>
                <th className="py-2">Method</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">{p.reference}</td>
                  <td className="py-2 text-slate-500">{p.date}</td>
                  <td className="py-2 text-slate-500">{p.method}</td>
                  <td className="py-2 text-right font-medium text-emerald-600">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment" description={`Remaining balance ${money(remaining)}`} size="sm">
        <form action={pay} className="space-y-4">
          <Input label="Amount" name="amount" type="number" step="0.01" min="0.01" max={remaining} required defaultValue={remaining} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <Select label="Method" name="method" defaultValue="bank_transfer">
              <option value="bank_transfer">Bank transfer</option>
              <option value="credit_card">Credit card</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}