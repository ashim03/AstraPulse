"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  submitAttendanceCorrection,
  getMyCorrections,
  submitLeaveRequest,
  getMyLeaveRequests,
  cancelLeaveRequest,
  getLeaveBalance,
  type CorrectionType,
} from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Tabs, TabContent, useTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTimeNepal } from "@/lib/utils";
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Clock,
  FileEdit,
  Send,
  X,
} from "lucide-react";

type Correction = {
  id: string;
  date: string;
  type: string;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type LeaveReq = {
  id: string;
  typeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  createdAt: string;
  type: { id: string; name: string; color: string };
};

type LeaveBal = {
  typeId: string;
  typeName: string;
  color: string;
  daysPerYear: number;
  used: number;
  remaining: number;
};

export default function EmployeeRequestsPage() {
  return (
    <Suspense>
      <EmployeeRequestsContent />
    </Suspense>
  );
}

function EmployeeRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const tabs = useTabs(searchParams.get("tab") === "leaves" ? "leaves" : "corrections");

  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReq[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Form states
  const [correctionForm, setCorrectionForm] = useState({
    date: "",
    type: "" as CorrectionType | "",
    reason: "",
    clockIn: "",
    clockOut: "",
  });
  const [leaveForm, setLeaveForm] = useState({
    typeId: "",
    startDate: "",
    endDate: "",
    days: "",
    reason: "",
    isHalfDay: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [corrRes, leaveRes, balRes] = await Promise.all([
        getMyCorrections(),
        getMyLeaveRequests(),
        getLeaveBalance(),
      ]);
      if (corrRes.ok) setCorrections(corrRes.data as Correction[]);
      if (leaveRes.ok) setLeaveRequests(leaveRes.data as LeaveReq[]);
      if (balRes.ok) setLeaveBalance(balRes.data as LeaveBal[]);
    } catch {
      toast({ title: "Failed to load data", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCorrectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!correctionForm.date || !correctionForm.type || !correctionForm.reason) {
      setErrors({ date: !correctionForm.date ? "Required" : "", type: !correctionForm.type ? "Required" : "", reason: !correctionForm.reason ? "Required" : "" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitAttendanceCorrection({
        date: correctionForm.date,
        type: correctionForm.type as CorrectionType,
        reason: correctionForm.reason,
        clockIn: correctionForm.clockIn || undefined,
        clockOut: correctionForm.clockOut || undefined,
      });
      if (res.ok) {
        toast({ title: res.message ?? "Submitted", type: "success" });
        setShowCorrectionModal(false);
        setCorrectionForm({ date: "", type: "", reason: "", clockIn: "", clockOut: "" });
        setErrors({});
        loadData();
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
      toast({ title: "Something went wrong", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leaveForm.typeId || !leaveForm.startDate || !leaveForm.endDate) {
      setErrors({ typeId: !leaveForm.typeId ? "Required" : "", startDate: !leaveForm.startDate ? "Required" : "", endDate: !leaveForm.endDate ? "Required" : "" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitLeaveRequest({
        typeId: leaveForm.typeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        days: parseFloat(leaveForm.days) || 1,
        reason: leaveForm.reason,
        isHalfDay: leaveForm.isHalfDay,
      });
      if (res.ok) {
        toast({ title: res.message ?? "Submitted", type: "success" });
        setShowLeaveModal(false);
        setLeaveForm({ typeId: "", startDate: "", endDate: "", days: "", reason: "", isHalfDay: false });
        setErrors({});
        loadData();
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
      toast({ title: "Something went wrong", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      const res = await cancelLeaveRequest(id);
      if (res.ok) {
        toast({ title: res.message ?? "Cancelled", type: "success" });
        loadData();
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
      toast({ title: "Something went wrong", type: "error" });
    }
  }

  function correctionTypeLabel(type: string) {
    const labels: Record<string, string> = {
      missing_checkin: "Missing Check-in",
      missing_checkout: "Missing Checkout",
      incorrect_status: "Incorrect Status",
      device_failed: "Device Failed",
      other: "Other",
    };
    return labels[type] ?? type.replace(/_/g, " ");
  }

  const correctionColumns = [
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "reason", header: "Reason" },
    { key: "status", header: "Status" },
    { key: "adminResponse", header: "Admin Response" },
    { key: "submitted", header: "Submitted" },
  ];

  const leaveColumns = [
    { key: "type", header: "Type" },
    { key: "dates", header: "Dates" },
    { key: "days", header: "Days" },
    { key: "status", header: "Status" },
    { key: "reason", header: "Reason" },
    { key: "actions", header: "" },
  ];

  return (
    <>
      <PageHeader
        title="My Requests"
        subtitle="Submit and track attendance corrections and leave requests"
      />

      <Tabs
        items={[
          { value: "corrections", label: "Attendance Corrections", icon: <Clock className="h-4 w-4" />, count: corrections.length },
          { value: "leaves", label: "Leave Requests", icon: <CalendarDays className="h-4 w-4" />, count: leaveRequests.length },
        ]}
        value={tabs.value}
        onChange={tabs.setValue}
        className="mb-6"
      />

      <TabContent value="corrections" active={tabs.value}>
        <Card>
          <CardHeader
            title="Attendance Corrections"
            subtitle={`${corrections.length} request(s) submitted`}
            action={
              <Button leftIcon={<FileEdit className="h-4 w-4" />} onClick={() => setShowCorrectionModal(true)} size="sm">
                Submit Correction
              </Button>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    {correctionColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3">{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                  ) : corrections.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No corrections submitted yet</td></tr>
                  ) : (
                    corrections.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700">{formatDate(c.date)}</td>
                        <td className="px-4 py-3"><Badge tone="blue">{correctionTypeLabel(c.type)}</Badge></td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{c.reason || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{c.reviewedBy || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </TabContent>

      <TabContent value="leaves" active={tabs.value}>
        {/* Leave Balance */}
        <Card className="mb-4">
          <CardHeader title="My Leave Balance" subtitle={`${new Date().getFullYear()} entitlements`} />
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {leaveBalance.length === 0 ? (
                <p className="text-sm text-slate-400">No leave types configured</p>
              ) : (
                leaveBalance.map((b) => (
                  <div key={b.typeId} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{b.typeName}</p>
                      <p className="text-xs text-slate-400">
                        {b.remaining}d remaining / {b.daysPerYear}d total
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        {/* Leave Requests Table */}
        <Card>
          <CardHeader
            title="My Leave Requests"
            subtitle={`${leaveRequests.length} request(s)`}
            action={
              <Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setShowLeaveModal(true)} size="sm">
                New Leave Request
              </Button>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase text-slate-500">
                    {leaveColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3">{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                  ) : leaveRequests.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leave requests yet</td></tr>
                  ) : (
                    leaveRequests.map((l) => (
                      <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: l.type.color }} />
                            <span className="font-medium text-slate-700">{l.type.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(l.startDate)} — {formatDate(l.endDate)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{l.days}d</td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{l.reason || "—"}</td>
                        <td className="px-4 py-3">
                          {l.status === "pending" && (
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(l.id)}>
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </TabContent>

      {/* Correction Modal */}
      <Modal
        open={showCorrectionModal}
        onClose={() => { setShowCorrectionModal(false); setErrors({}); }}
        title="Submit Attendance Correction"
        description="Request a correction for a missed or incorrect attendance record."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCorrectionModal(false)}>Cancel</Button>
            <Button onClick={handleCorrectionSubmit} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>Submit</Button>
          </>
        }
      >
        <form onSubmit={handleCorrectionSubmit} className="space-y-4">
          <Input
            label="Date"
            type="date"
            required
            value={correctionForm.date}
            onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
            error={errors.date}
          />
          <Select
            label="Correction Type"
            required
            value={correctionForm.type}
            onChange={(e) => setCorrectionForm({ ...correctionForm, type: e.target.value as CorrectionType })}
            error={errors.type}
          >
            <option value="">Select type...</option>
            <option value="missing_checkin">Missing Check-in</option>
            <option value="missing_checkout">Missing Checkout</option>
            <option value="incorrect_status">Incorrect Status</option>
            <option value="device_failed">Device Failed</option>
            <option value="other">Other</option>
          </Select>
          <Textarea
            label="Reason"
            required
            placeholder="Explain why you need this correction..."
            value={correctionForm.reason}
            onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
            error={errors.reason}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Clock In Time (optional)"
              type="time"
              value={correctionForm.clockIn}
              onChange={(e) => setCorrectionForm({ ...correctionForm, clockIn: e.target.value })}
            />
            <Input
              label="Clock Out Time (optional)"
              type="time"
              value={correctionForm.clockOut}
              onChange={(e) => setCorrectionForm({ ...correctionForm, clockOut: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Leave Request Modal */}
      <Modal
        open={showLeaveModal}
        onClose={() => { setShowLeaveModal(false); setErrors({}); }}
        title="Submit Leave Request"
        description="Request time off from work."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
            <Button onClick={handleLeaveSubmit} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>Submit</Button>
          </>
        }
      >
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <Select
            label="Leave Type"
            required
            value={leaveForm.typeId}
            onChange={(e) => setLeaveForm({ ...leaveForm, typeId: e.target.value })}
            error={errors.typeId}
          >
            <option value="">Select leave type...</option>
            {leaveBalance.map((b) => (
              <option key={b.typeId} value={b.typeId}>{b.typeName} ({b.remaining}d remaining)</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              required
              value={leaveForm.startDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
              error={errors.startDate}
            />
            <Input
              label="End Date"
              type="date"
              required
              value={leaveForm.endDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
              error={errors.endDate}
            />
          </div>
          <Input
            label="Number of Days"
            type="number"
            min="0.5"
            step="0.5"
            value={leaveForm.days}
            onChange={(e) => setLeaveForm({ ...leaveForm, days: e.target.value })}
            hint="Leave blank to auto-calculate from dates"
          />
          <Checkbox
            label="Half Day"
            description="Check if this is a half-day leave"
            checked={leaveForm.isHalfDay}
            onChange={(e) => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
          />
          <Textarea
            label="Reason"
            placeholder="Reason for leave..."
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
          />
        </form>
      </Modal>
    </>
  );
}
