"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { createWorkRecordAction, approveWorkRecordAction, deleteWorkRecordAction } from "./actions";

export type EmployeeOption = { id: string; name: string };

export function WorkRecordManager({
  rows,
  employees,
  stats,
}: {
  rows: SmartRow[];
  employees: EmployeeOption[];
  stats: { billable: number; approved: number; pending: number; total: number };
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "employee", header: "Employee", kind: "avatar" },
    { key: "project", header: "Project", minWidth: 200 },
    { key: "date", header: "Date", kind: "date" },
    { key: "hours", header: "Hours", kind: "number" },
    { key: "billable", header: "Billable", kind: "boolean" },
    { key: "status", header: "Status", kind: "status" },
  ];

  async function submit(formData: FormData) {
    setPending(true);
    const res = await createWorkRecordAction(formData);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Created", type: "success" });
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function approve(id: string) {
    const res = await approveWorkRecordAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteWorkRecordAction(id);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm sm:gap-6">
          <Stat label="Total hours" value={stats.total.toFixed(1)} />
          <Stat label="Billable" value={stats.billable.toFixed(1)} tone="green" />
          <Stat label="Approved" value={stats.approved.toFixed(1)} tone="green" />
          <Stat label="Pending" value={stats.pending.toFixed(1)} tone="amber" />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Log work
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["employee", "project"]}
        searchPlaceholder="Search records..."
        filters={[{ key: "status", label: "Status", options: ["pending", "approved", "rejected"].map((s) => ({ value: s, label: s })) }]}
        rowActions={[
          {
            label: "Approve",
            icon: <Check className="h-4 w-4" />,
            tone: "success",
            show: (r) => r.status === "pending",
            onClick: (r) => approve(String(r.id)),
          },
          {
            label: "Reject",
            icon: <X className="h-4 w-4" />,
            tone: "danger",
            show: (r) => r.status === "pending",
            onClick: (r) => remove(String(r.id)),
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            tone: "danger",
            onClick: (r) => remove(String(r.id)),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Log work" description="Record billable hours against a project" size="lg">
        <form action={submit} className="space-y-4">
          <Select label="Employee" name="employeeId" required error={errors.employeeId}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
          <Input label="Project" name="project" required error={errors.project} placeholder="e.g. Q3 Website Revamp" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" name="date" type="date" required error={errors.date} />
            <Input label="Hours" name="hours" type="number" step="0.25" min="0.25" max="24" required error={errors.hours} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start time" name="startTime" type="time" />
            <Input label="End time" name="endTime" type="time" />
          </div>
          <Textarea label="Description" name="description" rows={3} placeholder="What was worked on?" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="billable" defaultChecked className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Billable to client
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}