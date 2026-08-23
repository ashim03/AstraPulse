"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  CheckCircle2,
  Lock,
  Archive,
  Calendar,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import {
  createPayrollPeriodAction,
  updatePayrollPeriodAction,
  runAutoSalaryAction,
} from "../actions";

type PeriodRow = {
  id: string;
  name: string;
  frequency: string;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: string;
  isCurrent: boolean;
  createdAt: string;
};

export function PeriodManager({
  rows,
  workspaceId,
}: {
  rows: PeriodRow[];
  workspaceId: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    frequency: "monthly",
    startDate: "",
    endDate: "",
    paymentDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading("create");

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("frequency", formData.frequency);
    fd.append("startDate", formData.startDate);
    fd.append("endDate", formData.endDate);
    fd.append("paymentDate", formData.paymentDate);

    const res = await createPayrollPeriodAction(fd);
    setLoading(null);

    if (res.ok) {
      toast({ title: "Period created", type: "success" });
      setShowCreate(false);
      setFormData({ name: "", frequency: "monthly", startDate: "", endDate: "", paymentDate: "" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
      setErrors(res.fieldErrors ?? {});
    }
  }

  async function handleStatusUpdate(id: string, status: string) {
    setLoading(id);
    const res = await updatePayrollPeriodAction(id, status);
    setLoading(null);

    if (res.ok) {
      toast({ title: `Period ${status}`, type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  async function handleAutoSalary(periodId: string) {
    setLoading(periodId);
    const res = await runAutoSalaryAction(periodId);
    setLoading(null);

    if (res.ok) {
      toast({ title: "Payroll generated", type: "success" });
      router.push("/payroll");
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  function getStatusActions(period: PeriodRow) {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "success" }> = [];

    if (period.status === "upcoming") {
      actions.push({
        label: "Activate",
        icon: <Play className="h-4 w-4" />,
        onClick: () => handleStatusUpdate(period.id, "active"),
        variant: "success",
      });
    }

    if (period.status === "active") {
      actions.push({
        label: "Process",
        icon: <Settings className="h-4 w-4" />,
        onClick: () => handleAutoSalary(period.id),
        variant: "primary",
      });
      actions.push({
        label: "Complete",
        icon: <CheckCircle2 className="h-4 w-4" />,
        onClick: () => handleStatusUpdate(period.id, "completed"),
        variant: "secondary",
      });
    }

    if (period.status === "completed") {
      actions.push({
        label: "Close",
        icon: <Lock className="h-4 w-4" />,
        onClick: () => handleStatusUpdate(period.id, "closed"),
        variant: "outline",
      });
    }

    return actions;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Define payroll periods to organize salary processing cycles.
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Period
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {rows.map((period) => (
                  <tr
                    key={period.id}
                    className={`transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${period.isCurrent ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {period.name}
                        </span>
                        {period.isCurrent && (
                          <Badge tone="blue" dot>Current</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize">
                      {period.frequency}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(period.startDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(period.endDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(period.paymentDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={period.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getStatusActions(period).map((action) => (
                          <Button
                            key={action.label}
                            variant={action.variant}
                            size="sm"
                            onClick={action.onClick}
                            loading={loading === period.id}
                            leftIcon={action.icon}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Calendar className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="mt-3 text-sm font-medium text-slate-500">No periods found</p>
                      <p className="mt-1 text-xs text-slate-400">Create your first payroll period to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Payroll Period"
        description="Define a new payroll period for salary processing."
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Period Name"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g. August 2026"
            required
            className="min-h-[44px]"
          />
          <Select
            label="Frequency"
            value={formData.frequency}
            onChange={(e) => setFormData((f) => ({ ...f, frequency: e.target.value }))}
            error={errors.frequency}
            className="min-h-[44px]"
          >
            <option value="monthly">Monthly</option>
            <option value="biweekly">Bi-Weekly</option>
            <option value="weekly">Weekly</option>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
              error={errors.startDate}
              required
              className="min-h-[44px]"
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
              error={errors.endDate}
              required
              className="min-h-[44px]"
            />
          </div>
          <Input
            label="Payment Date"
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData((f) => ({ ...f, paymentDate: e.target.value }))}
            error={errors.paymentDate}
            required
            className="min-h-[44px]"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={loading === "create"}>
              Create Period
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
