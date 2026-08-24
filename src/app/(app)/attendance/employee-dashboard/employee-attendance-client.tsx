"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, differenceInMinutes } from "date-fns";
import { parseDateSafe, formatTimeNepal } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Coffee, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Moon } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { getEmployeeAttendanceDashboardAction } from "../actions";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
};

type AttendanceRecord = {
  date: string;
  status: string;
  hours: number;
  clockIn: string | null;
  clockOut: string | null;
  isHalfDay: boolean;
  lateMinutes: number;
  overtime: number;
  breakMinutes: number;
};

type DashboardData = {
  employee: { id: string; name: string; employeeId: string; department: { name: string } | null; position: { name: string } | null; baseSalary: number };
  todayRecord: { clockIn: Date | null; clockOut: Date | null; status: string; hours: number; breakMinutes: number; lateMinutes: number; overtime: number } | null;
  dailyData: AttendanceRecord[];
  breaks: Array<{ breakOut: Date; breakIn: Date | null; duration: number; status: string }>;
  overtimeRecords: Array<{ date: Date; hours: number; type: string; status: string }>;
  stats: {
    totalDays: number;
    present: number;
    absent: number;
    halfDays: number;
    leave: number;
    late: number;
    overtime: number;
    attendancePct: number;
  };
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  leave: "bg-blue-500",
  overtime: "bg-violet-500",
  "half-day": "bg-yellow-500",
  weekend: "bg-slate-300 dark:bg-slate-600",
  holiday: "bg-purple-500",
};

const STATUS_BG: Record<string, string> = {
  present: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  late: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  absent: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  leave: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  overtime: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
};

export function EmployeeAttendanceClient({
  employees,
  initialEmployeeId,
  initialMonth,
}: {
  employees: Employee[];
  initialEmployeeId: string;
  initialMonth: string;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getEmployeeAttendanceDashboardAction(employeeId, month);
      if (result.ok) {
        setData(result.data as unknown as DashboardData);
      }
    } catch (e) {
      console.error("Failed to fetch attendance data", e);
    }
    setLoading(false);
  }, [employeeId, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEmployeeChange = (id: string) => {
    setEmployeeId(id);
    const sp = new URLSearchParams();
    sp.set("employeeId", id);
    sp.set("month", month);
    router.push(`?${sp.toString()}`, { scroll: false });
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    const current = parseDateSafe(month + "-01") ?? new Date();
    const newMonth = direction === "next" ? addMonths(current, 1) : subMonths(current, 1);
    const newMonthStr = format(newMonth, "yyyy-MM");
    setMonth(newMonthStr);
    const sp = new URLSearchParams();
    sp.set("employeeId", employeeId);
    sp.set("month", newMonthStr);
    router.push(`?${sp.toString()}`, { scroll: false });
  };

  const todayRecord = data?.todayRecord;
  const todayStatus = todayRecord?.status || "absent";
  const statusIndicatorColor =
    todayStatus === "present"
      ? todayRecord && todayRecord.lateMinutes > 0
        ? "text-amber-500"
        : "text-emerald-500"
      : todayStatus === "absent"
        ? "text-red-500"
        : todayStatus === "leave"
          ? "text-blue-500"
          : todayStatus === "overtime"
            ? "text-violet-500"
            : "text-slate-400";

  const parsedMonth = parseDateSafe(month + "-01") ?? new Date();
  const monthStart = startOfMonth(parsedMonth);
  const monthEnd = endOfMonth(parsedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const dailyMap = new Map((data?.dailyData || []).map((d) => [d.date, d]));

  const stats = data?.stats;
  const workingHoursData = (data?.dailyData || []).filter((d) => d.hours > 0).map((d) => ({
    date: format(parseDateSafe(d.date) ?? new Date(), "d"),
    hours: d.hours,
  }));
  const maxHours = Math.max(8, ...workingHoursData.map((d) => d.hours));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={employeeId}
          onChange={(e) => handleEmployeeChange(e.target.value)}
          className="w-full sm:w-64 min-h-[44px]"
        >
          <option value="">Select Employee</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name} ({emp.employeeId}) - {emp.department}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => handleMonthChange("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-700 dark:text-slate-300">
            {format(parseDateSafe(month + "-01") ?? new Date(), "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => handleMonthChange("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!employeeId && (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-slate-500">Select an employee to view attendance details.</p>
          </CardBody>
        </Card>
      )}

      {loading && employeeId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-7 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && employeeId && data && (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50 sm:px-5">
              <div className={cn("h-3 w-3 rounded-full", STATUS_COLORS[todayStatus] || "bg-slate-300")} />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Today&apos;s Attendance</p>
                <p className="text-xs text-slate-500">
                  {data.employee.name} &middot; {data.employee.employeeId}
                </p>
              </div>
            </div>
            <CardBody>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                <div>
                  <p className="text-xs font-medium text-slate-500">Status</p>
                  <Badge tone={todayStatus === "present" ? "green" : todayStatus === "late" ? "amber" : todayStatus === "absent" ? "red" : todayStatus === "leave" ? "blue" : "gray"}>
                    {todayStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Clock In</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                    {todayRecord?.clockIn ? formatTimeNepal(todayRecord.clockIn) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Clock Out</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <LogOut className="h-3.5 w-3.5 text-red-500" />
                    {todayRecord?.clockOut ? formatTimeNepal(todayRecord.clockOut) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Working Hours</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    {todayRecord?.hours ? `${todayRecord.hours.toFixed(1)}h` : "0h"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Break</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Coffee className="h-3.5 w-3.5 text-amber-500" />
                    {todayRecord?.breakMinutes ? `${todayRecord.breakMinutes}m` : "0m"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Overtime</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                    {todayRecord?.overtime ? `${todayRecord.overtime.toFixed(1)}h` : "0h"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Late</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <AlertTriangle className={cn("h-3.5 w-3.5", (todayRecord?.lateMinutes || 0) > 0 ? "text-amber-500" : "text-emerald-500")} />
                    {todayRecord?.lateMinutes ? `${todayRecord.lateMinutes}m` : "0m"}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Present"
              value={stats?.present || 0}
              icon={CheckCircle2}
              iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
              footer={<p className="text-xs text-slate-400">{stats?.attendancePct || 0}% attendance</p>}
            />
            <StatCard
              title="Absent"
              value={stats?.absent || 0}
              icon={XCircle}
              iconClass="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
            />
            <StatCard
              title="Half Days"
              value={stats?.halfDays || 0}
              icon={Moon}
              iconClass="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400"
            />
            <StatCard
              title="Leave"
              value={stats?.leave || 0}
              icon={Coffee}
              iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
            />
            <StatCard
              title="Overtime Days"
              value={stats?.overtime || 0}
              icon={TrendingUp}
              iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Monthly Calendar" subtitle={format(parseDateSafe(month + "-01") ?? new Date(), "MMMM yyyy")} />
              <CardBody>
                <div className="grid grid-cols-7 gap-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-1.5 text-center text-xs font-semibold text-slate-500">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {daysInMonth.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const record = dailyMap.get(dateKey);
                    const status = record?.status || "";
                    const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          "relative flex flex-col items-center rounded-lg border p-1.5 transition",
                          isToday
                            ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20"
                            : status
                              ? STATUS_BG[status] || "border-transparent bg-white dark:bg-slate-800"
                              : "border-transparent bg-white dark:bg-slate-800",
                          "hover:shadow-sm"
                        )}
                      >
                        <span className={cn("text-xs font-medium", isToday ? "text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-400")}>
                          {format(day, "d")}
                        </span>
                        {status && (
                          <div className={cn("mt-1 h-2 w-2 rounded-full", STATUS_COLORS[status] || "bg-slate-300")} />
                        )}
                        {record?.isHalfDay && status !== "absent" && (
                          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                  {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                      <span className="text-xs text-slate-500 capitalize">{status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Working Hours" subtitle={`${workingHoursData.length} days with data`} />
              <CardBody>
                {workingHoursData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No working hours data for this month.</p>
                ) : (
                  <div className="space-y-1.5">
                    {workingHoursData.map((d) => (
                      <div key={d.date} className="flex items-center gap-2">
                        <span className="w-6 text-right text-xs text-slate-500">{d.date}</span>
                        <div className="flex-1">
                          <div className="h-4 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
                            <div
                              className={cn(
                                "h-full rounded transition-all",
                                d.hours >= 8 ? "bg-emerald-500" : d.hours >= 6 ? "bg-amber-500" : "bg-red-400"
                              )}
                              style={{ width: `${(d.hours / maxHours) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-300">
                          {d.hours.toFixed(1)}h
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent Attendance" subtitle="Last 10 records" />
              <CardBody className="p-0">
                {(data?.dailyData || []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No attendance records.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {(data?.dailyData || []).slice(-10).reverse().map((record) => (
                      <div key={record.date} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS_COLORS[record.status] || "bg-slate-300")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {format(parseDateSafe(record.date) ?? new Date(), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {record.clockIn
                              ? formatTimeNepal(record.clockIn)
                              : "—"}
                            {record.clockOut ? ` — ${formatTimeNepal(record.clockOut)}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
                            {(record.hours ?? 0).toFixed(1)}h
                          </p>
                          {record.lateMinutes > 0 && (
                            <p className="text-xs text-amber-600">+{record.lateMinutes}m late</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Break History" subtitle={`${data?.breaks?.length || 0} breaks recorded`} />
              <CardBody className="p-0">
                {(!data?.breaks || data.breaks.length === 0) ? (
                  <p className="py-8 text-center text-sm text-slate-400">No breaks recorded this month.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {data.breaks.slice(0, 10).map((brk, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <Coffee className="h-4 w-4 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {format(parseDateSafe(brk.breakOut) ?? new Date(), "MMM d, h:mm a")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {brk.breakIn ? `Returned at ${format(parseDateSafe(brk.breakIn) ?? new Date(), "h:mm a")}` : "Still on break"}
                          </p>
                        </div>
                        <Badge tone={brk.status === "completed" ? "green" : brk.status === "late_return" ? "red" : "blue"}>
                          {brk.duration}m
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
