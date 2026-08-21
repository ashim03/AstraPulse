"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Checkbox } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ConfirmationDialog } from "@/components/ui/modal";
import { createHolidayAction, deleteHolidayAction } from "./actions";

export type HolidayRow = { id: string; name: string; date: string; recurring: boolean; region: string | null; upcoming: boolean };

export function HolidayManager({ initial }: { initial: HolidayRow[] }) {
  const [items, setItems] = useState<HolidayRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<HolidayRow | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  async function submit(fd: FormData) {
    setPending(true);
    const res = await createHolidayAction(fd);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Added", type: "success" });
      setOpen(false);
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
    const res = await deleteHolidayAction(deleting.id);
    setPending(false);
    setDeleting(null);
    if (res.ok) {
      toast({ title: res.message ?? "Removed", type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add Holiday</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((h) => (
          <div key={h.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <PartyPopper className="h-5 w-5" />
              </span>
              <button
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => setDeleting(h)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-900">{h.name}</h3>
            <p className="text-sm text-slate-500">{h.date}</p>
            <div className="mt-auto flex items-center gap-2 pt-4">
              {h.recurring && <Badge tone="indigo">Recurring</Badge>}
              <Badge tone={h.upcoming ? "green" : "gray"}>{h.upcoming ? "Upcoming" : "Passed"}</Badge>
              {h.region && <Badge>{h.region}</Badge>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Holiday" description="Add a public holiday or company day off">
        <form action={submit} className="space-y-4">
          <Input label="Name" name="name" required error={errors.name} placeholder="e.g. New Year's Day" />
          <Input label="Date" name="date" type="date" required error={errors.date} />
          <Input label="Region" name="region" placeholder="e.g. US" />
          <Checkbox label="Recurring" description="Repeat every year automatically" name="recurring" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Adding..." : "Add Holiday"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove holiday"
        description={`Remove "${deleting?.name}" from the calendar?`}
        confirmLabel={pending ? "Removing..." : "Remove"}
        confirmVariant="danger"
        loading={pending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}