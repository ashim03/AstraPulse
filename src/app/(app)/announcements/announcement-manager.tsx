"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { createAnnouncementAction, deleteAnnouncementAction } from "./actions";

export type DepartmentOption = { id: string; name: string };

export type Row = {
  id: string;
  title: string;
  message: string;
  audience: string;
  department: string | null;
  priority: string;
  author: string;
  publishDate: string | null;
  createdAt: string;
};

export function AnnouncementManager({ rows, departments, canCreate = true, canDelete = true }: { rows: Row[]; departments: DepartmentOption[]; canCreate?: boolean; canDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createAnnouncementAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Published", type: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function remove(id: string) {
    const res = await deleteAnnouncementAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  const tone = (p: string) => (p === "urgent" ? "red" : p === "high" ? "amber" : "gray");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</h3>
                <Badge tone={tone(r.priority) as never}>{r.priority}</Badge>
                <Badge>{r.audience}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{r.message}</p>
              <p className="mt-2 text-xs text-slate-400">
                By {r.author} • {r.createdAt}{r.department ? ` • ${r.department}` : ""}
              </p>
            </div>
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No announcements yet.</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New announcement" description="Publish an update for your team" size="lg">
        <form action={submit} className="space-y-4">
          <Input label="Title" name="title" required error={errors.title} placeholder="e.g. New benefits package" />
          <Textarea label="Message" name="message" required error={errors.message} rows={4} placeholder="What do you want to share?" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Audience" name="audience" defaultValue="all">
              <option value="all">Everyone</option>
              <option value="department">Department</option>
              <option value="managers">Managers</option>
            </Select>
            <Select label="Priority" name="priority" defaultValue="normal">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <Select label="Department (optional)" name="departmentId">
            <option value="">—</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Publish date (optional)" name="publishDate" type="date" />
            <Input label="Expiry date (optional)" name="expiryDate" type="date" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Publish</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}