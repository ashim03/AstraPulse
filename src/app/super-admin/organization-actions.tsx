"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  activateOrganizationAction,
  suspendOrganizationAction,
  approvePaymentAction,
  updateSubscriptionPriceAction,
} from "./actions";

export function OrganizationActions({
  workspaceId,
  status,
  subscription,
}: {
  workspaceId: string;
  status: string;
  subscription: {
    plan: string;
    price: number;
    employeeLimit: number;
    isTrial: boolean;
    paymentStatus: string;
    trialEndDate: Date | null;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showApprovePayment, setShowApprovePayment] = useState(false);
  const [showEditSubscription, setShowEditSubscription] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(subscription?.price?.toString() ?? "0");
  const [editForm, setEditForm] = useState({
    plan: subscription?.plan ?? "starter",
    price: subscription?.price?.toString() ?? "0",
    employeeLimit: subscription?.employeeLimit?.toString() ?? "15",
  });

  const handleActivate = () => {
    startTransition(async () => {
      await activateOrganizationAction(workspaceId);
      router.refresh();
    });
  };

  const handleSuspend = () => {
    startTransition(async () => {
      await suspendOrganizationAction(workspaceId);
      router.refresh();
    });
  };

  const handleApprovePayment = () => {
    startTransition(async () => {
      await approvePaymentAction(workspaceId, Number(paymentAmount));
      setShowApprovePayment(false);
      router.refresh();
    });
  };

  const handleUpdateSubscription = () => {
    startTransition(async () => {
      await updateSubscriptionPriceAction(workspaceId, Number(editForm.price), editForm.plan, Number(editForm.employeeLimit));
      setShowEditSubscription(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && (
        <Button variant="success" size="sm" loading={pending} onClick={handleActivate}>
          Activate
        </Button>
      )}
      {status === "active" && (
        <Button variant="danger" size="sm" loading={pending} onClick={handleSuspend}>
          Suspend
        </Button>
      )}

      {subscription && subscription.paymentStatus !== "paid" && (
        <Button variant="success" size="sm" onClick={() => setShowApprovePayment(true)}>
          Approve Payment
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={() => setShowEditSubscription(true)}>
        Edit Subscription
      </Button>

      {showApprovePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Approve Payment</h3>
              <p className="mt-1 text-sm text-slate-500">Confirm payment to activate the subscription.</p>
              <div className="mt-4">
                <Input
                  label="Payment Amount"
                  type="number"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={() => setShowApprovePayment(false)}>
                  Cancel
                </Button>
                <Button variant="success" size="sm" loading={pending} onClick={handleApprovePayment}>
                  Confirm & Activate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Subscription</h3>
              <div className="mt-4 space-y-4">
                <Select
                  label="Plan"
                  value={editForm.plan}
                  onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                </Select>
                <Input
                  label="Price (per month)"
                  type="number"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
                <Input
                  label="Employee Limit"
                  type="number"
                  min="1"
                  value={editForm.employeeLimit}
                  onChange={(e) => setEditForm({ ...editForm, employeeLimit: e.target.value })}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" size="sm" onClick={() => setShowEditSubscription(false)}>
                  Cancel
                </Button>
                <Button size="sm" loading={pending} onClick={handleUpdateSubscription}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
