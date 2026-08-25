"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, X, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { createLeaveRequestAction, approveLeaveRequestAction, rejectLeaveRequestAction, cancelLeaveRequestAction } from "./actions";

export type LeaveTypeOption = { id: string; name: string; daysPerYear: number };
export type EmployeeOption = { id: string; name: string };

export function LeaveManager({
  rows,
  types,
  employees,
  canApprove,
  myEmployeeId,
}: {
  rows: SmartRow[];
  types: LeaveTypeOption[];
  employees: EmployeeOption[];
  canApprove: boolean;
  myEmployeeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "name", header: "Employee", kind: "avatar", avatarSubKey: "department", minWidth: 190 },
    { key: "type", header: "Type" },
    { key: "startDate", header: "From", kind: "date" },
    { key: "endDate", header: "To", kind: "date" },
    { key: "days", header: "Days", align: "right" },
    { key: "status", header: "Status", kind: "status" },
    { key: "reason", header: "Reason" },
  ];

  async function submit(fd: FormData) {
    setPendingId("__new");
    const res = await createLeaveRequestAction(fd);
    setPendingId(null);
    if (res.ok) {
      toast({ title: res.message ?? "Submitted", type: "success" });
      setOpen(false);
      setErrors({});
      router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast({ title: res.error, type: "error" });
    }
  }

  async function decide(id: string, action: (id: string) => Promise<{ ok: boolean; message?: string; error?: string }>, label: string) {
    setPendingId(id);
    const res = await action(id);
    setPendingId(null);
    if (res.ok) {
      toast({ title: res.message ?? label, type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error ?? "Failed", type: "error" });
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          New Leave Request
        </Button>
      </div>

      <SmartTable
        rows={rows}
        columns={columns}
        rowKey="id"
        searchKeys={["name", "type", "reason"]}
        searchPlaceholder="Search by employee, type..."
        filters={[{ key: "status", label: "Status", options: ["pending", "approved", "rejected", "cancelled", "draft"].map((s) => ({ value: s, label: s })) }]}
        rowActions={
          canApprove
            ? [
                {
                  label: "Approve",
                  icon: <Check className="h-4 w-4" />,
                  tone: "success",
                  show: (r) => r.status === "pending",
                  onClick: (r) => decide(String(r.id), approveLeaveRequestAction, "Approved"),
                },
                {
                  label: "Reject",
                  icon: <X className="h-4 w-4" />,
                  tone: "danger",
                  show: (r) => r.status === "pending",
                  onClick: (r) => decide(String(r.id), rejectLeaveRequestAction, "Rejected"),
                },
                {
                  label: "Cancel",
                  icon: <Ban className="h-4 w-4" />,
                  show: (r) => r.status === "pending" || r.status === "approved",
                  onClick: (r) => decide(String(r.id), cancelLeaveRequestAction, "Cancelled"),
                },
              ]
            : [
                {
                  label: "Cancel",
                  icon: <Ban className="h-4 w-4" />,
                  show: (r) => r.status === "pending" && !!myEmployeeId && r.employeeId === myEmployeeId,
                  onClick: (r) => decide(String(r.id), cancelLeaveRequestAction, "Cancelled"),
                },
              ]
        }
        emptyTitle="No leave requests"
        emptyDescription="Create a request to get started."
        exportFilename="leave-requests.csv"
        pageSize={10}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New Leave Request" description="Submit a leave request" size="lg">
        <form action={submit} className="space-y-4">
          {!canApprove && myEmployeeId ? (
            <input type="hidden" name="employeeId" value={myEmployeeId} />
          ) : (
            <Select label="Employee" name="employeeId" required defaultValue="" error={errors.employeeId}>
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Leave type" name="typeId" required defaultValue="" error={errors.typeId}>
              <option value="">Select type...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.daysPerYear}d/yr)</option>
              ))}
            </Select>
            <Input label="Start date" name="startDate" type="date" required error={errors.startDate} />
            <Input label="End date" name="endDate" type="date" required error={errors.endDate} />
          </div>
          <Textarea label="Reason" name="reason" rows={3} placeholder="Reason for leave" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pendingId === "__new"}>{pendingId === "__new" ? "Submitting..." : "Submit Request"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}