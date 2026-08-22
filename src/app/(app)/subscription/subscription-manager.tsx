"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { money } from "@/lib/utils";
import { PLANS } from "@/lib/constants";
import { changePlanAction, cancelSubscriptionAction } from "./actions";

export function SubscriptionManager({
  currentPlan,
  status,
  billingPeriod,
  employeeLimit,
  renewalDate,
  employeeCount,
}: {
  currentPlan: string;
  status: string;
  billingPeriod: string;
  employeeLimit: number;
  renewalDate: string;
  employeeCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"monthly" | "yearly">(billingPeriod === "yearly" ? "yearly" : "monthly");
  const [pending, setPending] = useState(false);

  async function changePlan(planName: string) {
    setPending(true);
    const fd = new FormData();
    fd.set("plan", planName);
    fd.set("period", period);
    const res = await changePlanAction(fd);
    setPending(false);
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  async function cancel() {
    const res = await cancelSubscriptionAction();
    toast({ title: res.ok ? (res.message ?? "Done") : res.error, type: res.ok ? "success" : "error" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{currentPlan} plan</h2>
              <Badge>{status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {employeeCount} / {employeeLimit} employees • Renews {renewalDate} ({billingPeriod})
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 p-0.5">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${period === p ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {status === "active" && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={cancel}>Cancel subscription</Button>
          </div>
        )}
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = p.name === currentPlan;
          const price = period === "yearly" ? p.yearly : p.monthly;
          return (
            <Card key={p.name} className={`flex flex-col p-5 ${active ? "ring-2 ring-indigo-600" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{p.name}</h3>
                {active && <Badge>Current</Badge>}
              </div>
              <p className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {money(price)}
                <span className="text-sm font-normal text-slate-400">/{period === "yearly" ? "year" : "month"}</span>
              </p>
              <ul className="mb-5 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
              {active ? (
                <Button variant="outline" disabled>Current plan</Button>
              ) : (
                <Button loading={pending} onClick={() => changePlan(p.name)}>Switch to {p.name}</Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}