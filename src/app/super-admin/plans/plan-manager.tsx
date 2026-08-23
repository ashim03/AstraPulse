"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Users, HardDrive, CheckCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createPlanAction, updatePlanAction, deletePlanAction } from "./actions";

type PlanData = {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  employeeLimit: number;
  userLimit: number;
  storageLimit: number;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  subscriberCount: number;
};

const EMPTY_FORM: Omit<PlanData, "id" | "subscriberCount" | "isDefault" | "sortOrder"> = {
  name: "",
  description: "",
  monthlyPrice: 49,
  yearlyPrice: 490,
  employeeLimit: 15,
  userLimit: 50,
  storageLimit: 1024,
  features: [],
  isActive: true,
};

export function PlanManager({ plans }: { plans: PlanData[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [featuresInput, setFeaturesInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setFeaturesInput("");
    setError(null);
    setShowModal(true);
  }

  function openEdit(plan: PlanData) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      employeeLimit: plan.employeeLimit,
      userLimit: plan.userLimit,
      storageLimit: plan.storageLimit,
      features: plan.features,
      isActive: plan.isActive,
    });
    setFeaturesInput(plan.features.join(", "));
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPlan(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const features = featuresInput
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    if (!form.name.trim()) {
      setError("Plan name is required");
      return;
    }

    startTransition(async () => {
      const payload = {
        ...form,
        features,
        description: form.description || undefined,
      };
      const result = editingPlan
        ? await updatePlanAction(editingPlan.id, { ...payload, isActive: form.isActive })
        : await createPlanAction(payload);

      if (!result.ok) {
        setError(result.error);
      } else {
        closeModal();
      }
    });
  }

  function handleDelete(planId: string) {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    startTransition(async () => {
      const result = await deletePlanAction(planId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition">
          <Plus className="h-4 w-4" /> Create Plan
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={cn(!plan.isActive && "opacity-60")}>
            <CardBody className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
                    {plan.isDefault && <Badge tone="indigo">Default</Badge>}
                    {!plan.isActive && <Badge tone="red">Inactive</Badge>}
                  </div>
                  {plan.description && (
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!plan.isDefault && plan.subscriberCount === 0 && (
                    <button onClick={() => handleDelete(plan.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Monthly</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">${plan.monthlyPrice}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Yearly</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">${plan.yearlyPrice}</p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {plan.employeeLimit} employees</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {plan.userLimit} users</span>
                <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {plan.storageLimit} MB</span>
              </div>

              {plan.features.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{plan.subscriberCount}</span> subscriber{plan.subscriberCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingPlan ? "Edit Plan" : "Create Plan"}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.monthlyPrice}
                    onChange={(e) => setForm({ ...form, monthlyPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Yearly Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.yearlyPrice}
                    onChange={(e) => setForm({ ...form, yearlyPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employee Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={form.employeeLimit}
                    onChange={(e) => setForm({ ...form, employeeLimit: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">User Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={form.userLimit}
                    onChange={(e) => setForm({ ...form, userLimit: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Storage (MB)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.storageLimit}
                    onChange={(e) => setForm({ ...form, storageLimit: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Features (comma-separated)</label>
                <input
                  type="text"
                  value={featuresInput}
                  onChange={(e) => setFeaturesInput(e.target.value)}
                  placeholder="Up to 15 employees, Core HR & attendance, Leave management"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {editingPlan && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
