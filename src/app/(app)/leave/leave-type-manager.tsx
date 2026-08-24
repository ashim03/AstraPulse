"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createLeaveTypeAction, updateLeaveTypeAction, deleteLeaveTypeAction } from "./actions";

export type LeaveTypeItem = {
  id: string;
  name: string;
  daysPerYear: number;
  carryForward: boolean;
  color: string;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export function LeaveTypeManager({ types }: { types: LeaveTypeItem[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const router = useRouter();
  const { toast } = useToast();

  function openCreate() {
    setEditing(null);
    setSelectedColor("#6366f1");
    setErrors({});
    setOpen(true);
  }

  function openEdit(t: LeaveTypeItem) {
    setEditing(t);
    setSelectedColor(t.color);
    setErrors({});
    setOpen(true);
  }

  async function submit(fd: FormData) {
    fd.set("color", selectedColor);
    setPending(true);
    const res = editing
      ? await updateLeaveTypeAction(editing.id, fd)
      : await createLeaveTypeAction(fd);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Saved", type: "success" });
      setOpen(false);
      setErrors({});
      router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast({ title: res.error, type: "error" });
    }
  }

  async function handleDelete(t: LeaveTypeItem) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    setPending(true);
    const res = await deleteLeaveTypeAction(t.id);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Deleted", type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leave Types</h3>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          New Type
        </Button>
      </div>

      {types.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No leave types configured. Create one to get started.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{t.name}</p>
                <p className="text-xs text-slate-400">{t.daysPerYear}d/year{t.carryForward ? " · Carry forward" : ""}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(t)} disabled={pending} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Leave Type" : "New Leave Type"} description="Configure leave type for your workspace" size="md">
        <form action={submit} className="space-y-4">
          <Input label="Name" name="name" defaultValue={editing?.name ?? ""} required error={errors.name} placeholder="e.g. Sick Leave" />
          <Input label="Days per year" name="daysPerYear" type="number" defaultValue={editing?.daysPerYear ?? 0} required error={errors.daysPerYear} min={0} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`h-7 w-7 rounded-full transition ${selectedColor === c ? "ring-2 ring-offset-2 ring-slate-600" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" name="carryForward" defaultChecked={editing?.carryForward ?? false} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
            Allow carry forward to next year
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
