"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmationDialog } from "@/components/ui/modal";
import { Input, Textarea, FieldError } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { createDepartmentAction, updateDepartmentAction, deleteDepartmentAction } from "../staff/actions";

export type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  manager: string | null;
  employeeCount: number;
  budget: number;
};

export function DepartmentManager({ initial }: { initial: DepartmentRow[] }) {
  const [items, setItems] = useState<DepartmentRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  async function save(formData: FormData) {
    setPending(true);
    const res = editing
      ? await updateDepartmentAction(editing.id, formData)
      : await createDepartmentAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Saved", type: "success" });
      setOpen(false);
      setEditing(null);
      setErrors({});
      router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast({ title: res.error, type: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const res = await deleteDepartmentAction(deleting.id);
    setPending(false);
    setDeleting(null);
    if (res.ok) {
      toast({ title: res.message ?? "Deleted", type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setErrors({}); setOpen(true); }}>
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <div key={d.id} className="card flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => { setEditing(d); setErrors({}); setOpen(true); }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setDeleting(d)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{d.name}</h3>
            {d.manager && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <Avatar name={d.manager} size="xs" /> {d.manager}
              </p>
            )}
            <p className="mt-2 line-clamp-2 text-sm text-slate-400">{d.description || "No description"}</p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <Badge tone="indigo">{d.employeeCount} employees</Badge>
              <span className="text-xs text-slate-400">Budget {d.budget > 0 ? `$${d.budget.toLocaleString()}` : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Department" : "Add Department"} description={editing ? `Update ${editing.name}` : "Create a new department"}>
        <form action={save} className="space-y-4">
          <Input label="Name" name="name" defaultValue={editing?.name ?? ""} required error={errors.name} placeholder="e.g. Engineering" />
          <Textarea label="Description" name="description" defaultValue={editing?.description ?? ""} rows={3} placeholder="What does this department do?" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete department"
        description={`Delete "${deleting?.name}"? Employees in this department will be unassigned.`}
        confirmLabel={pending ? "Deleting..." : "Delete"}
        confirmVariant="danger"
        loading={pending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}