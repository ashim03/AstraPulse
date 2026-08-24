"use client";

import { useState, useCallback } from "react";
import { format, subDays } from "date-fns";
import { FileText, Download, Printer, Loader2, CalendarDays, Users, Clock, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { getAttendanceReportAction } from "../actions";
import { money, downloadCSV, formatTimeNepal } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
};

type ReportRecord = {
  id: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  hours: number;
  status: string;
  lateMinutes: number;
  overtime: number;
  breakMinutes: number;
  isHalfDay: boolean;
  note: string | null;
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: { name: string } | null;
    position: { name: string } | null;
  };
};

type ReportData = {
  records: ReportRecord[];
  stats: {
    total: number;
    present: number;
    absent: number;
    late: number;
    overtime: number;
    avgHours: number;
  };
};

const REPORT_TABS = [
  { value: "summary", label: "Summary", icon: <FileText className="h-4 w-4" /> },
  { value: "late", label: "Late Employees", icon: <AlertTriangle className="h-4 w-4" /> },
  { value: "absent", label: "Absent Employees", icon: <XCircle className="h-4 w-4" /> },
  { value: "overtime", label: "Overtime", icon: <TrendingUp className="h-4 w-4" /> },
  { value: "hours", label: "Working Hours", icon: <Clock className="h-4 w-4" /> },
];

export function AttendanceReportsClient({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: Array<{ id: string; name: string }>;
}) {
  const [reportType, setReportType] = useState("summary");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAttendanceReportAction(reportType, startDate, endDate, {
        department: departmentFilter || undefined,
        employeeId: employeeFilter || undefined,
        status: statusFilter || undefined,
      });
      if (result.ok) {
        setData(result.data as unknown as ReportData);
      }
    } catch (e) {
      console.error("Failed to generate report", e);
    }
    setLoading(false);
  }, [reportType, startDate, endDate, departmentFilter, employeeFilter, statusFilter]);

  const exportCSV = useCallback(() => {
    if (!data?.records?.length) return;
    const headers = ["Employee", "Employee ID", "Department", "Date", "Clock In", "Clock Out", "Hours", "Status", "Late (min)", "Overtime (h)", "Break (min)"];
    const rows = data.records.map((r) => [
      r.employee.name,
      r.employee.employeeId,
      r.employee.department?.name || "",
      format(new Date(r.date), "yyyy-MM-dd"),
      r.clockIn ? formatTimeNepal(r.clockIn) : "",
      r.clockOut ? formatTimeNepal(r.clockOut) : "",
      (r.hours ?? 0).toFixed(2),
      r.status,
      r.lateMinutes,
      r.overtime,
      r.breakMinutes,
    ]);
    downloadCSV(`attendance-report-${reportType}-${startDate}-${endDate}.csv`, [headers, ...rows]);
  }, [data, reportType, startDate, endDate]);

  const printReport = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="label">Report Type</label>
              <div className="mt-1.5">
                <Tabs items={REPORT_TABS} value={reportType} onChange={setReportType} />
              </div>
            </div>

            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="min-h-[44px]"
            />

            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="min-h-[44px]"
            />

            <Select
              label="Department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <Select
              label="Employee"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto min-h-[36px]"
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="leave">Leave</option>
              <option value="overtime">Overtime</option>
            </Select>

            <Button onClick={generateReport} loading={loading} leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}>
              Generate Report
            </Button>

            {data && (
              <>
                <Button variant="outline" size="sm" onClick={exportCSV} leftIcon={<Download className="h-4 w-4" />}>
                  Export CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={printReport} leftIcon={<Printer className="h-4 w-4" />}>
                  Print
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Records"
              value={data.stats.total}
              icon={FileText}
            />
            <StatCard
              title="Present"
              value={data.stats.present}
              icon={Users}
              iconClass="bg-emerald-100 text-emerald-600"
            />
            <StatCard
              title="Late"
              value={data.stats.late}
              icon={AlertTriangle}
              iconClass="bg-amber-100 text-amber-600"
            />
            <StatCard
              title="Absent"
              value={data.stats.absent}
              icon={XCircle}
              iconClass="bg-red-100 text-red-600"
            />
            <StatCard
              title="Avg Hours"
              value={`${data.stats.avgHours}h`}
              icon={Clock}
              iconClass="bg-blue-100 text-blue-600"
            />
          </div>

          <Card>
            <CardHeader
              title={`${REPORT_TABS.find((t) => t.value === reportType)?.label || "Report"} Results`}
              subtitle={`${data.records.length} records found`}
            />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
                      <th className="px-4 py-3 font-medium text-slate-500 sm:px-5">Employee</th>
                      <th className="px-4 py-3 font-medium text-slate-500">Department</th>
                      <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                      <th className="px-4 py-3 font-medium text-slate-500">Clock In</th>
                      <th className="px-4 py-3 font-medium text-slate-500">Clock Out</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Hours</th>
                      <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Late</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">OT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {data.records.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                          No records found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      data.records.slice(0, 200).map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 sm:px-5">
                            <p className="font-medium text-slate-800">{record.employee.name}</p>
                            <p className="text-xs text-slate-400">{record.employee.employeeId}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{record.employee.department?.name || "—"}</td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {format(new Date(record.date), "MMM d, yyyy")}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {record.clockIn ? formatTimeNepal(record.clockIn) : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {record.clockOut ? formatTimeNepal(record.clockOut) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">
                            {(record.hours ?? 0).toFixed(1)}h
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {record.lateMinutes > 0 ? (
                              <span className="text-amber-600">{record.lateMinutes}m</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {record.overtime > 0 ? (
                              <span className="text-violet-600">{(record.overtime ?? 0).toFixed(1)}h</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.records.length > 200 && (
                <div className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700">
                  Showing 200 of {data.records.length} records. Export CSV for full data.
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {!data && !loading && (
        <Card>
          <CardBody className="py-16 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-500">Select parameters and generate a report</p>
            <p className="mt-1 text-sm text-slate-400">Choose a report type, date range, and optional filters to get started.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
