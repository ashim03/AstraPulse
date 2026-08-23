"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Download,
  Play,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Modal, ConfirmationDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { money, num, formatDate } from "@/lib/utils";
import { generatePayrollPreviewAction, generatePayrollFromPreviewAction } from "../actions";

type EmployeePreview = {
  id: string;
  name: string;
  employeeId: string;
  departmentName: string;
  departmentId: string | null;
  baseSalary: number;
  salaryType: string;
};

type Department = { id: string; name: string };

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: string;
};

type PreviewRow = {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  baseSalary: number;
  salaryType: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalHours: number;
  overtimeHours: number;
  lateMinutes: number;
  allowances: number;
  bonuses: number;
  overtimePay: number;
  weekendPay: number;
  holidayPay: number;
  gross: number;
  lateDeduction: number;
  absentDeduction: number;
  leaveDeduction: number;
  halfDayDeduction: number;
  totalDeductions: number;
  tax: number;
  advanceDeduction: number;
  net: number;
  status: "ready" | "needs_review";
};

type SortKey = "employeeName" | "departmentName" | "net" | "gross" | "baseSalary";
type SortDir = "asc" | "desc";

export function PreviewClient({
  employees,
  departments,
  periods,
  initialStart,
  initialEnd,
}: {
  employees: EmployeePreview[];
  departments: Department[];
  periods: Period[];
  initialStart: string;
  initialEnd: string;
}) {
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.id ?? "");
  const [deptFilter, setDeptFilter] = useState("all");
  const [empFilter, setEmpFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const filteredData = useMemo(() => {
    let data = [...previewData];

    if (deptFilter !== "all") {
      data = data.filter((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return emp?.departmentId === deptFilter;
      });
    }

    if (empFilter !== "all") {
      data = data.filter((r) => r.employeeId === empFilter);
    }

    data.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortKey === "employeeName") {
        aVal = a.employeeName;
        bVal = b.employeeName;
      } else if (sortKey === "departmentName") {
        aVal = a.departmentName;
        bVal = b.departmentName;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return data;
  }, [previewData, deptFilter, empFilter, sortKey, sortDir, employees]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        baseSalary: acc.baseSalary + row.baseSalary,
        allowances: acc.allowances + row.allowances,
        bonuses: acc.bonuses + row.bonuses,
        overtimePay: acc.overtimePay + row.overtimePay,
        gross: acc.gross + row.gross,
        totalDeductions: acc.totalDeductions + row.totalDeductions,
        tax: acc.tax + row.tax,
        advanceDeduction: acc.advanceDeduction + row.advanceDeduction,
        net: acc.net + row.net,
      }),
      { baseSalary: 0, allowances: 0, bonuses: 0, overtimePay: 0, gross: 0, totalDeductions: 0, tax: 0, advanceDeduction: 0, net: 0 }
    );
  }, [filteredData]);

  async function loadPreview() {
    setLoading(true);
    try {
      const result = await generatePayrollPreviewAction(initialStart, initialEnd);
      if (result.ok) {
        setPreviewData(result.data);
      } else {
        toast({ title: result.error || "Failed to load preview", type: "error" });
      }
    } catch {
      toast({ title: "Failed to load preview", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedPeriod) {
      toast({ title: "Please select a payroll period", type: "warning" });
      return;
    }

    setGenerating(true);
    try {
      const period = periods.find((p) => p.id === selectedPeriod);
      if (!period) return;

      const result = await generatePayrollFromPreviewAction(
        previewData.map((row) => ({
          ...row,
          departmentId: employees.find((e) => e.id === row.employeeId)?.departmentId ?? null,
        })),
        { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate }
      );

      if (result.ok) {
        toast({ title: "Payroll generated successfully", type: "success" });
        setShowConfirm(false);
        router.push("/payroll");
      } else {
        toast({ title: result.error || "Failed to generate payroll", type: "error" });
      }
    } catch {
      toast({ title: "Failed to generate payroll", type: "error" });
    } finally {
      setGenerating(false);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Salary Preview"
          subtitle={`${filteredData.length} employees`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadPreview} loading={loading}>
                <Download className="h-4 w-4" /> Load Preview
              </Button>
              {previewData.length > 0 && (
                <Button size="sm" onClick={() => setShowConfirm(true)}>
                  <Play className="h-4 w-4" /> Generate Payroll
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Filter:</span>
            </div>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-44 min-h-[44px] text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="w-44 min-h-[44px] text-sm"
            >
              <option value="all">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </div>

          {previewData.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">No preview data loaded</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click &quot;Load Preview&quot; to calculate salaries</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            </div>
          )}

          {previewData.length > 0 && !loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort("employeeName")} className="flex items-center gap-1 hover:text-slate-700">
                        Employee <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort("departmentName")} className="flex items-center gap-1 hover:text-slate-700">
                        Dept <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Basic</th>
                    <th className="px-4 py-3 text-right">Present</th>
                    <th className="px-4 py-3 text-right">Absent</th>
                    <th className="px-4 py-3 text-right">OT Hours</th>
                    <th className="px-4 py-3 text-right">OT Pay</th>
                    <th className="px-4 py-3 text-right">Allowances</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => toggleSort("net")} className="flex items-center gap-1 hover:text-slate-700">
                        Net <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filteredData.map((row) => (
                    <>
                      <tr
                        key={row.employeeId}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        onClick={() => toggleRow(row.employeeId)}
                      >
                        <td className="px-4 py-3">
                          {expandedRows.has(row.employeeId) ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {row.employeeName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {row.departmentName}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {money(row.baseSalary)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {num(row.presentDays)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={row.absentDays > 0 ? "font-medium text-red-600" : "text-slate-700 dark:text-slate-300"}>
                            {num(row.absentDays)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {num(row.overtimeHours)}h
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {money(row.overtimePay)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {money(row.allowances)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={row.totalDeductions > 0 ? "font-medium text-red-600" : "text-slate-700 dark:text-slate-300"}>
                            {money(row.totalDeductions)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {money(row.tax)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {money(row.net)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                      {expandedRows.has(row.employeeId) && (
                        <tr key={`${row.employeeId}-detail`}>
                          <td colSpan={13} className="bg-slate-50 px-8 py-4 dark:bg-slate-800/50">
                            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                              <div>
                                <span className="text-xs text-slate-500">Salary Type</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{row.salaryType}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Working Days</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{row.workingDays}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Half Days</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{row.halfDays}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Late Minutes</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{row.lateMinutes}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Total Hours</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{num(row.totalHours)}h</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Bonuses</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{money(row.bonuses)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Weekend Pay</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{money(row.weekendPay)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Holiday Pay</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{money(row.holidayPay)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Late Deduction</span>
                                <p className="font-medium text-red-600">{money(row.lateDeduction)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Absent Deduction</span>
                                <p className="font-medium text-red-600">{money(row.absentDeduction)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Leave Deduction</span>
                                <p className="font-medium text-red-600">{money(row.leaveDeduction)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Half-Day Deduction</span>
                                <p className="font-medium text-red-600">{money(row.halfDayDeduction)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Advance Deduction</span>
                                <p className="font-medium text-red-600">{money(row.advanceDeduction)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Paid Leave Days</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{num(row.paidLeaveDays)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Unpaid Leave Days</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{num(row.unpaidLeaveDays)}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Gross Salary</span>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{money(row.gross)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100" colSpan={2}>Totals</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{money(totals.baseSalary)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">—</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">—</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">—</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{money(totals.overtimePay)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{money(totals.allowances)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{money(totals.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{money(totals.tax)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">{money(totals.net)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone="blue">{filteredData.length}</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmationDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleGenerate}
        title="Generate Payroll"
        description={`This will create a payroll run for ${filteredData.length} employees with a total net of ${money(totals.net)}. This action cannot be undone.`}
        confirmLabel="Generate Payroll"
        loading={generating}
      />
    </div>
  );
}
