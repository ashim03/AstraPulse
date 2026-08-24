"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingDown,
  Clock,
  Calculator,
  Users,
  ArrowRight,
  ChevronDown,
  Eye,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { money, num } from "@/lib/utils";
import { generatePayrollAction } from "./actions";

type PayrollItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  overtimeHours: number;
  gross: number;
  deductions: number;
  tax: number;
  lateDeduction: number;
  absentDeduction: number;
  halfDayDeduction: number;
  leaveDeduction: number;
  advanceDeduction: number;
  net: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  workingDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalHours: number;
  weekendPay: number;
  holidayPay: number;
  paymentStatus: string;
};

type Period = {
  period: string;
  name: string;
  status: string;
  employeeCount: number;
};

type Totals = {
  totalPayroll: number;
  totalGross: number;
  totalDeductions: number;
  totalTax: number;
  avgSalary: number;
  totalOvertimePay: number;
  employeeCount: number;
};

export function PayrollDashboard({
  month,
  periods,
  items,
  totals,
  payrollStatus,
  payrollId,
}: {
  month: string;
  periods: Period[];
  items: PayrollItem[];
  totals: Totals;
  payrollStatus: string | null;
  payrollId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollItem | null>(null);

  function handleMonthChange(newMonth: string) {
    router.push(`/payroll?month=${newMonth}`);
  }

  function generatePrevMonth() {
    const [y, m] = month.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    handleMonthChange(prev);
  }

  function generateNextMonth() {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    handleMonthChange(next);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await generatePayrollAction(month);
    setGenerating(false);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      alert(res.error);
    }
  }

  const columns: SmartColumn[] = [
    {
      key: "employeeName",
      header: "Employee",
      kind: "avatar",
      avatarSubKey: "department",
      minWidth: 200,
    },
    { key: "department", header: "Department" },
    { key: "baseSalary", header: "Base Salary", kind: "money", align: "right" },
    {
      key: "presentDays",
      header: "Present",
      kind: "number",
      align: "center",
    },
    {
      key: "absentDays",
      header: "Absent",
      kind: "number",
      align: "center",
    },
    {
      key: "halfDays",
      header: "Half Days",
      kind: "number",
      align: "center",
    },
    {
      key: "overtimeHours",
      header: "OT Hours",
      kind: "number",
      align: "center",
    },
    { key: "overtime", header: "OT Pay", kind: "money", align: "right" },
    { key: "gross", header: "Gross", kind: "money", align: "right" },
    { key: "deductions", header: "Deductions", kind: "money", align: "right" },
    { key: "tax", header: "Tax", kind: "money", align: "right" },
    { key: "net", header: "Net Pay", kind: "money", align: "right" },
    {
      key: "paymentStatus",
      header: "Status",
      kind: "badge",
      badgeMap: {
        pending: { label: "Pending", tone: "amber" },
        paid: { label: "Paid", tone: "green" },
        processing: { label: "Processing", tone: "blue" },
      },
      badgeFallback: "Pending",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={generatePrevMonth}>
          ← Prev
        </Button>
        <div className="relative">
          <input
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          />
        </div>
        <Button variant="outline" size="sm" onClick={generateNextMonth}>
          Next →
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {payrollStatus && (
            <Badge
              tone={
                payrollStatus === "paid"
                  ? "green"
                  : payrollStatus === "approved"
                  ? "blue"
                  : payrollStatus === "calculated"
                  ? "amber"
                  : "gray"
              }
            >
              {payrollStatus}
            </Badge>
          )}
          {!payrollId && (
            <Button onClick={handleGenerate} loading={generating} size="sm">
              <Calculator className="h-4 w-4" /> Generate Payroll
            </Button>
          )}
          {payrollId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/payroll/${payrollId}`)}
            >
              <Eye className="h-4 w-4" /> View Details
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Net Payroll"
          value={money(totals.totalPayroll)}
          icon={DollarSign}
          footer={
            <p className="text-xs text-slate-400">
              {totals.employeeCount} employees
            </p>
          }
        />
        <StatCard
          title="Average Salary"
          value={money(totals.avgSalary)}
          icon={Users}
          footer={
            <p className="text-xs text-slate-400">
              Per employee net
            </p>
          }
        />
        <StatCard
          title="Total Deductions"
          value={money(totals.totalDeductions + totals.totalTax)}
          icon={TrendingDown}
          footer={
            <p className="text-xs text-red-500">
              Tax: {money(totals.totalTax)}
            </p>
          }
        />
        <StatCard
          title="Overtime Pay"
          value={money(totals.totalOvertimePay)}
          icon={Clock}
          footer={
            <p className="text-xs text-slate-400">
              Additional earnings
            </p>
          }
        />
      </div>

      {/* Payroll Table */}
      {items.length > 0 ? (
        <SmartTable
          rows={items as unknown as SmartRow[]}
          columns={columns}
          rowKey="id"
          searchKeys={["employeeName", "department", "position"]}
          searchPlaceholder="Search employees..."
          filters={[
            {
              key: "paymentStatus",
              label: "Payment Status",
              options: [
                { value: "pending", label: "Pending" },
                { value: "paid", label: "Paid" },
                { value: "processing", label: "Processing" },
              ],
            },
          ]}
          emptyTitle="No payroll data"
          emptyDescription="Generate payroll for this month to see employee salary breakdowns."
          exportFilename={`payroll-${month}.csv`}
          pageSize={15}
          rowActions={[
            {
              label: "View Payslip",
              icon: <Eye className="h-4 w-4" />,
              tone: "neutral",
              onClick: (r) => setSelectedPayslip(r as unknown as PayrollItem),
            },
          ]}
        />
      ) : (
        <Card className="p-12 text-center">
          <Calculator className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
            No Payroll Data
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            No payroll has been generated for {month}. Click &quot;Generate Payroll&quot; to calculate
            salaries for all active employees.
          </p>
          <Button className="mt-4" onClick={handleGenerate} loading={generating}>
            <Calculator className="h-4 w-4" /> Generate Payroll
          </Button>
        </Card>
      )}

      {/* Payslip Detail Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Payslip
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedPayslip.employeeName} — {month}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPayslip(null)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-4 p-6">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Employee</p>
                  <p className="font-medium">{selectedPayslip.employeeName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium">{selectedPayslip.department}</p>
                </div>
                <div>
                  <p className="text-slate-500">Position</p>
                  <p className="font-medium">{selectedPayslip.position}</p>
                </div>
                <div>
                  <p className="text-slate-500">Period</p>
                  <p className="font-medium">{month}</p>
                </div>
              </div>

              {/* Attendance */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Attendance
                </h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-slate-500">Working Days</p>
                    <p className="text-lg font-bold">{selectedPayslip.workingDays}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                    <p className="text-slate-500">Present</p>
                    <p className="text-lg font-bold text-emerald-600">{selectedPayslip.presentDays}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                    <p className="text-slate-500">Absent</p>
                    <p className="text-lg font-bold text-red-600">{selectedPayslip.absentDays}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <p className="text-slate-500">Half Days</p>
                    <p className="text-lg font-bold text-amber-600">{selectedPayslip.halfDays}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                    <p className="text-slate-500">OT Hours</p>
                    <p className="text-lg font-bold text-blue-600">{num(selectedPayslip.overtimeHours)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-slate-500">Total Hours</p>
                    <p className="text-lg font-bold">{num(selectedPayslip.totalHours)}</p>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Earnings
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Salary</span>
                    <span className="font-medium">{money(selectedPayslip.baseSalary)}</span>
                  </div>
                  {selectedPayslip.allowances > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allowances</span>
                      <span className="font-medium">{money(selectedPayslip.allowances)}</span>
                    </div>
                  )}
                  {selectedPayslip.bonuses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bonuses</span>
                      <span className="font-medium">{money(selectedPayslip.bonuses)}</span>
                    </div>
                  )}
                  {selectedPayslip.overtime > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Overtime Pay</span>
                      <span className="font-medium">{money(selectedPayslip.overtime)}</span>
                    </div>
                  )}
                  {selectedPayslip.weekendPay > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Weekend Pay</span>
                      <span className="font-medium">{money(selectedPayslip.weekendPay)}</span>
                    </div>
                  )}
                  {selectedPayslip.holidayPay > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Holiday Pay</span>
                      <span className="font-medium">{money(selectedPayslip.holidayPay)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 dark:border-slate-700">
                    <span className="font-semibold">Gross</span>
                    <span className="font-semibold">{money(selectedPayslip.gross)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Deductions
                </h3>
                <div className="space-y-1.5 text-sm">
                  {selectedPayslip.lateDeduction > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Late Deduction</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.lateDeduction)}</span>
                    </div>
                  )}
                  {selectedPayslip.absentDeduction > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Absent Deduction</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.absentDeduction)}</span>
                    </div>
                  )}
                  {selectedPayslip.halfDayDeduction > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Half Day Deduction</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.halfDayDeduction)}</span>
                    </div>
                  )}
                  {selectedPayslip.leaveDeduction > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Leave Deduction</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.leaveDeduction)}</span>
                    </div>
                  )}
                  {selectedPayslip.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.tax)}</span>
                    </div>
                  )}
                  {selectedPayslip.advanceDeduction > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Advance Deduction</span>
                      <span className="font-medium text-red-600">-{money(selectedPayslip.advanceDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 dark:border-slate-700">
                    <span className="font-semibold">Total Deductions</span>
                    <span className="font-semibold text-red-600">
                      -{money(selectedPayslip.deductions + selectedPayslip.tax + selectedPayslip.advanceDeduction)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Net Pay
                  </span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {money(selectedPayslip.net)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
