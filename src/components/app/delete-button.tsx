"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions";

export function DeleteButton({
  id,
  action,
  confirmText = "Are you sure? This cannot be undone.",
  label = "Delete",
  redirectTo,
  onDone,
}: {
  id: string;
  action: (id: string) => Promise<ActionResult>;
  confirmText?: string;
  label?: string;
  redirectTo?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function confirm() {
    setPending(true);
    const res = await action(id);
    setPending(false);
    setOpen(false);
    if (res.ok) {
      toast({ title: res.message ?? "Deleted", type: "success" });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
      onDone?.();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm deletion"
        description={confirmText}
        confirmLabel={pending ? "Deleting..." : "Delete"}
        confirmVariant="danger"
        loading={pending}
        onConfirm={() => void confirm()}
      />
    </>
  );
}