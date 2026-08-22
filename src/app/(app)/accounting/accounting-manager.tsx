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
import { createAccountAction, createJournalEntryAction, postJournalAction, createBankAccountAction } from "./actions";

export type AccountOption = { id: string; code: string; name: string; type: string; balance: number };

export function AccountingManager({
  accounts,
  journalRows,
  banks,
}: {
  accounts: AccountOption[];
  journalRows: { id: string; number: string; date: string; description: string; status: string }[];
  banks: { id: string; name: string; bank: string; accountNumber: string; currentBalance: number }[];
}) {
  const [tab, setTab] = useState<"accounts" | "journal" | "banks">("accounts");
  const [open, setOpen] = useState<"account" | "journal" | "bank" | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  async function submit(formData: FormData, kind: "account" | "journal" | "bank") {
    setPending(true);
    const res =
      kind === "account" ? await createAccountAction(formData) :
      kind === "journal" ? await createJournalEntryAction(formData) :
      await createBankAccountAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Done", type: "success" });
      setOpen(null);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function post(id: string) {
    const res = await postJournalAction(id);
    toast({ title: res.ok ? (res.message ?? "Posted") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  const typeTone = (t: string) =>
    t === "asset" || t === "expense" ? "green" : t === "liability" || t === "equity" ? "amber" : "sky";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600 p-0.5 scrollbar-thin">
          {(["accounts", "journal", "banks"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium capitalize ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === "accounts" && (
            <Button onClick={() => setOpen("account")}><Plus className="h-4 w-4" /> New account</Button>
          )}
          {tab === "journal" && (
            <Button onClick={() => setOpen("journal")}><Plus className="h-4 w-4" /> New entry</Button>
          )}
          {tab === "banks" && (
            <Button onClick={() => setOpen("bank")}><Plus className="h-4 w-4" /> Add bank</Button>
          )}
        </div>
      </div>

      {tab === "accounts" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.code}</td>
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{a.name}</td>
                    <td className="px-4 py-2"><Badge tone={typeTone(a.type) as never}>{a.type}</Badge></td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800 dark:text-slate-200">{money(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "journal" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {journalRows.map((j) => (
                  <tr key={j.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{j.number}</td>
                    <td className="px-4 py-2 text-slate-600">{j.date}</td>
                    <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{j.description}</td>
                    <td className="px-4 py-2"><Badge>{j.status}</Badge></td>
                    <td className="px-4 py-2 text-right">
                      {j.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => post(j.id)}>
                          <Send className="h-3.5 w-3.5" /> Post
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {journalRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No journal entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "banks" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {banks.map((b) => (
            <Card key={b.id} className="p-4">
              <p className="text-sm font-semibold text-slate-800">{b.name}</p>
              <p className="text-xs text-slate-500">{b.bank} • •••{b.accountNumber.slice(-4)}</p>
              <p className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">{money(b.currentBalance)}</p>
            </Card>
          ))}
          {banks.length === 0 && <p className="text-sm text-slate-400">No bank accounts yet.</p>}
        </div>
      )}

      <Modal open={open === "account"} onClose={() => setOpen(null)} title="New account" description="Add an account to the chart of accounts" size="sm">
        <form action={(fd) => submit(fd, "account")} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Code" name="code" required error={errors.code} placeholder="e.g. 1010" />
            <Select label="Type" name="type" required error={errors.type}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </div>
          <Input label="Name" name="name" required error={errors.name} placeholder="e.g. Checking Account" />
          <Input label="Opening balance" name="openingBalance" type="number" step="0.01" defaultValue={0} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="submit" loading={pending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={open === "journal"} onClose={() => setOpen(null)} title="New journal entry" description="Create a manual double-entry journal" size="lg">
        <form action={(fd) => submit(fd, "journal")} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" name="date" type="date" required error={errors.date} defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <Input label="Description" name="description" required error={errors.description} placeholder="e.g. Office rent for August" />
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Lines</p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Select label="Debit account" name="debitAccount" error={errors.debitAccount}>
                  <option value="">Select</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </Select>
                <Input label="Debit" name="debitAmount" type="number" step="0.01" min="0.01" required error={errors.debitAmount} />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Select label="Credit account" name="creditAccount" error={errors.creditAccount}>
                  <option value="">Select</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </Select>
                <Input label="Credit" name="creditAmount" type="number" step="0.01" min="0.01" required error={errors.creditAmount} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="submit" loading={pending}>Draft entry</Button>
          </div>
        </form>
      </Modal>

      <Modal open={open === "bank"} onClose={() => setOpen(null)} title="Add bank account" description="Link a bank account to the workspace" size="sm">
        <form action={(fd) => submit(fd, "bank")} className="space-y-4">
          <Input label="Name" name="name" required placeholder="e.g. Operating" />
          <Input label="Bank" name="bank" required placeholder="e.g. Chase" />
          <Input label="Account number" name="accountNumber" required />
          <Input label="Opening balance" name="openingBalance" type="number" step="0.01" defaultValue={0} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="submit" loading={pending}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}