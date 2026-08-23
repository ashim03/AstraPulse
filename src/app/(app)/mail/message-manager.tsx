"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Mail, MailOpen, Send, Inbox, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { sendMessageAction, markMessageReadAction, deleteMessageAction } from "./actions";

export type UserOption = { id: string; name: string; email: string; role?: { name: string }; workspaceName?: string };
export type MessageRow = {
  id: string;
  subject: string;
  body: string;
  senderId: string;
  sender: string;
  senderEmail?: string;
  mine: boolean;
  unread: boolean;
  recipients: string;
  recipientIds: string[];
  date: string;
  time: string;
  createdAt: Date;
};

type Tab = "inbox" | "sent" | "compose";

export function MessageManager({
  rows,
  users,
  meId,
  unreadCount,
}: {
  rows: MessageRow[];
  users: UserOption[];
  meId: string;
  unreadCount: number;
}) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const inbox = rows.filter((r) => !r.mine);
  const sent = rows.filter((r) => r.mine);
  const displayRows = tab === "inbox" ? inbox : sent;
  const filtered = filter
    ? displayRows.filter(
        (r) =>
          r.subject.toLowerCase().includes(filter.toLowerCase()) ||
          r.sender.toLowerCase().includes(filter.toLowerCase()) ||
          r.recipients.toLowerCase().includes(filter.toLowerCase())
      )
    : displayRows;

  async function submit(formData: FormData) {
    setPending(true);
    const res = await sendMessageAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Sent", type: "success" });
      setComposeOpen(false);
      setTab("sent");
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function openMessage(m: MessageRow) {
    setSelected(m);
    if (!m.mine && m.unread) {
      await markMessageReadAction(m.id);
      router.refresh();
    }
  }

  async function remove(id: string) {
    const res = await deleteMessageAction(id);
    toast({ title: res.ok ? (res.message ?? "Deleted") : res.error, type: res.ok ? "success" : "error" });
    setSelected(null);
    router.refresh();
  }

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    const interval = setInterval(handleRefresh, 30000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  return (
    <div className="space-y-4">
      {selected ? (
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{selected.subject}</h3>
              <p className="text-sm text-slate-500">
                {selected.mine ? `From you` : `From ${selected.sender}`} • {selected.date} {selected.time}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {selected.mine ? `To: ${selected.recipients}` : `To: ${selected.recipients}`}
              </p>
              {selected.senderEmail && !selected.mine && (
                <p className="mt-0.5 text-xs text-slate-400">{selected.senderEmail}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{selected.body || "—"}</p>
          </div>
          {!selected.mine && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
              <Button
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setTab("compose");
                  setComposeOpen(true);
                }}
              >
                Reply
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
              <button
                onClick={() => setTab("inbox")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === "inbox"
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                <Inbox className="h-4 w-4" />
                Inbox
                {unreadCount > 0 && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab("sent")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === "sent"
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                <Send className="h-4 w-4" />
                Sent
              </button>
              <button
                onClick={() => {
                  setTab("compose");
                  setComposeOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Compose
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search messages..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-48"
              />
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((m) => (
              <Card
                key={m.id}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                onClick={() => openMessage(m)}
              >
                <div className="text-slate-400">
                  {m.unread ? <MailOpen className="h-5 w-5 text-indigo-500" /> : <Mail className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${m.unread ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                      {m.subject}
                    </span>
                    {m.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {m.mine ? `To: ${m.recipients}` : `From: ${m.sender}`} • {m.date}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(m.id);
                  }}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                {tab === "inbox" ? "No messages in inbox." : "No sent messages."}
              </p>
            )}
          </div>
        </>
      )}

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Compose message" description="Send a message to team members" size="lg">
        <form action={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Recipients</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              {users.filter((u) => u.id !== meId).map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                  <input type="checkbox" name="recipients" value={u.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  {u.name}
                  <span className="text-xs text-slate-400">{u.email}</span>
                  {u.role && <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">{u.role.name}</span>}
                  {u.workspaceName && <span className="ml-auto rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{u.workspaceName}</span>}
                </label>
              ))}
              {users.filter((u) => u.id !== meId).length === 0 && (
                <p className="text-xs text-slate-400">No available recipients.</p>
              )}
            </div>
            {errors.recipients && <p className="mt-1 text-xs text-red-600">{errors.recipients}</p>}
          </div>
          <Input label="Subject" name="subject" required error={errors.subject} placeholder="e.g. Team sync tomorrow" />
          <Textarea label="Message" name="body" rows={5} placeholder="Write your message..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
