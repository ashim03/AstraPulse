"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Mail, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { sendMessageAction, markMessageReadAction, deleteMessageAction } from "./actions";

export type UserOption = { id: string; name: string; email: string };
export type Row = {
  id: string;
  subject: string;
  body: string;
  sender: string;
  mine: boolean;
  unread: boolean;
  recipients: string;
  date: string;
  time: string;
};

export function MailManager({ rows, users, meId }: { rows: Row[]; users: UserOption[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  async function submit(formData: FormData) {
    setPending(true);
    const res = await sendMessageAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Sent", type: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function openMessage(m: Row) {
    setSelected(m);
    if (!m.mine && m.unread) {
      const res = await markMessageReadAction(m.id);
      if (res.ok) router.refresh();
    }
  }

  async function remove(id: string) {
    const res = await deleteMessageAction(id);
    toast({ title: res.ok ? (res.message ?? "Deleted") : res.error, type: res.ok ? "success" : "error" });
    setSelected(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </div>

      {selected ? (
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{selected.subject}</h3>
              <p className="text-sm text-slate-500">From {selected.sender} • {selected.date} {selected.time}</p>
              <p className="mt-1 text-xs text-slate-400">To: {selected.recipients}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Back</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{selected.body || "—"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Card key={m.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50" onClick={() => openMessage(m)}>
              <div className="text-slate-400">
                {m.unread ? <MailOpen className="h-5 w-5 text-indigo-500" /> : <Mail className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm font-medium ${m.unread ? "text-slate-900" : "text-slate-700"}`}>{m.subject}</span>
                  {m.unread && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                </div>
                <p className="truncate text-xs text-slate-400">{m.mine ? `To: ${m.recipients}` : `From: ${m.sender}`} • {m.date}</p>
              </div>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Compose message" description="Send a message to teammates" size="lg">
        <form action={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Recipients</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              {users.filter((u) => u.id !== meId).map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" name="recipients" value={u.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  {u.name} <span className="text-xs text-slate-400">{u.email}</span>
                </label>
              ))}
            </div>
            {errors.recipients && <p className="mt-1 text-xs text-red-600">{errors.recipients}</p>}
          </div>
          <Input label="Subject" name="subject" required error={errors.subject} placeholder="e.g. Team sync tomorrow" />
          <Textarea label="Message" name="body" rows={5} placeholder="Write your message..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Send</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}