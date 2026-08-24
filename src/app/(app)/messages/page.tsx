"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send,
  Inbox,
  Mail,
  MailOpen,
  Plus,
  ArrowLeft,
  Reply,
  RefreshCw,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import {
  sendMessageAction,
  getMyMessagesAction,
  markAsReadAction,
  getUnreadCountAction,
  replyToMessageAction,
  getUsersAction,
  type MessageWithRelations,
  type MessageCategory,
} from "./actions";
import { formatDateNepal } from "@/lib/utils";

type Tab = "inbox" | "sent";

const categoryTone: Record<string, "blue" | "amber" | "violet" | "gray"> = {
  attendance: "blue",
  leave: "amber",
  payroll: "violet",
  general: "gray",
};

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role?: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState<MessageWithRelations | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [msgRes, unreadRes, usersRes] = await Promise.all([
      getMyMessagesAction(),
      getUnreadCountAction(),
      getUsersAction(),
    ]);
    if (msgRes.ok && msgRes.data) setMessages(msgRes.data);
    if (unreadRes.ok && typeof unreadRes.data === "number") setUnreadCount(unreadRes.data);
    if (usersRes.ok && usersRes.data) setUsers(usersRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const myId = messages[0]?.sender?.id ?? "";
  const inbox = messages.filter((m) => m.senderId !== myId);
  const sent = messages.filter((m) => m.senderId === myId);
  const display = tab === "inbox" ? inbox : sent;
  const filtered = filter
    ? display.filter(
        (m) =>
          m.subject.toLowerCase().includes(filter.toLowerCase()) ||
          m.sender.name.toLowerCase().includes(filter.toLowerCase())
      )
    : display;

  function getOtherName(m: MessageWithRelations) {
    if (m.senderId === myId) {
      return m.recipients.map((r) => r.recipient.name).join(", ");
    }
    return m.sender.name;
  }

  function isUnread(m: MessageWithRelations) {
    if (m.senderId === myId) return false;
    const myRecipient = m.recipients.find((r) => r.recipientId === myId);
    return myRecipient && !myRecipient.readAt;
  }

  async function handleOpen(m: MessageWithRelations) {
    setSelected(m);
    if (m.senderId !== myId && isUnread(m)) {
      await markAsReadAction(m.id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === m.id
            ? {
                ...msg,
                recipients: msg.recipients.map((r) =>
                  r.recipientId === myId ? { ...r, readAt: new Date() } : r
                ),
              }
            : msg
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function handleSend(formData: FormData) {
    setPending(true);
    const recipientId = String(formData.get("recipientId") ?? "");
    const subject = String(formData.get("subject") ?? "");
    const body = String(formData.get("body") ?? "");
    const category = String(formData.get("category") ?? "general") as MessageCategory;

    const res = await sendMessageAction(recipientId, subject, body, category);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Sent", type: "success" });
      setComposeOpen(false);
      load();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  async function handleReply(formData: FormData) {
    if (!selected) return;
    setPending(true);
    const body = String(formData.get("body") ?? "");
    const res = await replyToMessageAction(selected.id, body);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Reply sent", type: "success" });
      setReplyOpen(false);
      setSelected(null);
      load();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  if (selected) {
    const cat = (selected.category || "general") as MessageCategory;
    return (
      <div className="space-y-6">
        <PageHeader
          title="Messages"
          subtitle="Internal messaging"
          actions={
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          }
        />
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selected.subject}
                </h2>
                <Badge tone={categoryTone[cat] ?? "gray"}>
                  <Tag className="h-3 w-3 mr-0.5" />
                  {cat}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                From <span className="font-medium text-slate-700 dark:text-slate-300">{selected.sender.name}</span>
                {" · "}
                {formatDateNepal(selected.createdAt)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                To: {selected.recipients.map((r) => r.recipient.name).join(", ")}
              </p>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {selected.body || "—"}
            </p>
          </div>
          {selected.parentId && (
            <p className="mt-3 text-xs text-slate-400">
              This is a reply to a previous message.
            </p>
          )}
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3 flex gap-2">
            {selected.senderId !== myId && (
              <Button
                size="sm"
                onClick={() => {
                  setReplyOpen(true);
                }}
              >
                <Reply className="h-4 w-4 mr-1" /> Reply
              </Button>
            )}
          </div>
        </Card>

        <Modal
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          title="Reply"
          description={`Replying to ${selected.sender.name}`}
          size="lg"
        >
          <form action={handleReply} className="space-y-4">
            <p className="text-sm text-slate-500">
              <span className="font-medium">Subject:</span> Re: {selected.subject.replace(/^Re:\s*/i, "")}
            </p>
            <Textarea label="Message" name="body" rows={5} placeholder="Write your reply..." required />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setReplyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                <Send className="h-4 w-4 mr-1" /> Send Reply
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Internal employee-admin messaging"
        actions={
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="text-sm text-slate-500">
                {unreadCount} unread
              </span>
            )}
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Compose
            </Button>
          </div>
        }
      />

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
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search messages..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading messages...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const unread = isUnread(m);
            const cat = (m.category || "general") as MessageCategory;
            return (
              <Card
                key={m.id}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                onClick={() => handleOpen(m)}
              >
                <div className="shrink-0 text-slate-400">
                  {unread ? (
                    <MailOpen className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm font-medium ${
                        unread
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {m.subject}
                    </span>
                    {unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    )}
                    <Badge tone={categoryTone[cat] ?? "gray"} className="shrink-0">
                      {cat}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-slate-400 mt-0.5">
                    {m.senderId === myId ? `To: ${getOtherName(m)}` : `From: ${m.sender.name}`}
                    {" · "}
                    {formatDateNepal(m.createdAt)}
                  </p>
                  {m.body && (
                    <p className="truncate text-xs text-slate-400 mt-0.5">{m.body}</p>
                  )}
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              {tab === "inbox" ? "No messages in inbox." : "No sent messages."}
            </div>
          )}
        </div>
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Compose message"
        description="Send a message to a team member"
        size="lg"
      >
        <form action={handleSend} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Recipient
            </label>
            <Select name="recipientId" required>
              <option value="">Select a recipient...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}){u.role ? ` — ${u.role}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Select name="category" label="Category" defaultValue="general">
            <option value="general">General</option>
            <option value="attendance">Attendance</option>
            <option value="leave">Leave</option>
            <option value="payroll">Payroll</option>
          </Select>
          <Input label="Subject" name="subject" required placeholder="e.g. Shift change request" />
          <Textarea label="Message" name="body" rows={5} required placeholder="Write your message..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
