"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  ArrowRight,
  Loader2,
  Filter,
} from "lucide-react";
import { PageHeader, Breadcrumb } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatTimeNepal } from "@/lib/utils";
import {
  syncSingleEmployee,
  syncAllEmployees,
  retryFailed,
  pullAttendance,
  getDeviceSyncData,
  type ActionResponse,
} from "./actions";
import type { AttendanceDevice, AttendanceDeviceLog, Employee } from "@prisma/client";

type DeviceSyncPageData = {
  device: AttendanceDevice | null;
  employees: Pick<Employee, "id" | "employeeId" | "name" | "status" | "deviceEmployeeId">[];
  syncStatuses: Array<{
    employeeId: string;
    employeeName: string;
    deviceEmployeeId: string | null;
    syncStatus: "synced" | "pending" | "failed";
    lastSyncAttempt?: Date;
  }>;
  logs: (AttendanceDeviceLog & { device: { name: string } })[];
  deviceOnline: boolean;
  failedSyncLogs: number;
};

export default function DeviceSyncPage() {
  const [data, setData] = useState<DeviceSyncPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const fetchData = async () => {
    try {
      const result = await getDeviceSyncData();
      if (result) setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (
    action: () => Promise<ActionResponse>,
    actionKey: string
  ) => {
    setActionLoading(actionKey);
    try {
      const result = await action();
      if (!result.success) {
        alert(result.message);
      }
      await fetchData();
    } catch {
      alert("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredEmployees = data?.employees.filter((emp) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "synced") return emp.deviceEmployeeId !== null;
    if (statusFilter === "pending") return emp.deviceEmployeeId === null && emp.status === "active";
    if (statusFilter === "failed") return emp.status !== "active" && emp.deviceEmployeeId === null;
    return true;
  }) ?? [];

  const syncedCount = data?.employees.filter((e) => e.deviceEmployeeId).length ?? 0;
  const pendingCount = data?.employees.filter((e) => !e.deviceEmployeeId && e.status === "active").length ?? 0;
  const failedCount = data?.employees.filter((e) => !e.deviceEmployeeId && e.status !== "active").length ?? 0;

  if (loading) {
    return (
      <>
        <PageHeader
          title="Device Sync Management"
          subtitle="Manage attendance device synchronization"
          breadcrumb={<Breadcrumb items={[{ label: "Staff", href: "/staff" }, { label: "Device Sync" }]} />}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Device Sync Management"
          subtitle="Manage attendance device synchronization"
          breadcrumb={<Breadcrumb items={[{ label: "Staff", href: "/staff" }, { label: "Device Sync" }]} />}
        />
        <Card>
          <CardBody className="py-12 text-center">
            <HardDrive className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Access denied or no data available.</p>
            <Link href="/staff" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
              Back to Staff
            </Link>
          </CardBody>
        </Card>
      </>
    );
  }

  const { device, deviceOnline, logs } = data;

  return (
    <>
      <PageHeader
        title="Device Sync Management"
        subtitle="Manage attendance device synchronization"
        breadcrumb={<Breadcrumb items={[{ label: "Staff", href: "/staff" }, { label: "Device Sync" }]} />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => handleAction(pullAttendance, "pull")}
              disabled={actionLoading === "pull" || !device}
            >
              {actionLoading === "pull" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pull Attendance"}
            </Button>
            <Button
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => handleAction(syncAllEmployees, "sync-all")}
              disabled={actionLoading === "sync-all" || !device}
            >
              {actionLoading === "sync-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sync All"}
            </Button>
          </div>
        }
      />

      {/* Device Status Section */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={deviceOnline ? "border-emerald-200" : "border-red-200"}>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Connection Status</p>
                <div className="mt-1 flex items-center gap-2">
                  {deviceOnline ? (
                    <Wifi className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                  <span className={`text-lg font-semibold ${deviceOnline ? "text-emerald-700" : "text-red-700"}`}>
                    {deviceOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              <span className={`h-3 w-3 rounded-full ${deviceOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <p className="text-sm font-medium text-slate-500">Device Info</p>
            <div className="mt-1">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{device?.name ?? "—"}</p>
              <p className="text-xs text-slate-400 font-mono">{device?.ipAddress ?? "—"}:{device?.port ?? 4370}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <p className="text-sm font-medium text-slate-500">Last Sync</p>
            <div className="mt-1">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                {device?.lastSyncAt ? formatDate(device.lastSyncAt, "MMM d, HH:mm") : "Never"}
              </p>
              <p className="text-xs text-slate-400">
                {device?.lastSyncStatus === "success" ? "Successful" : device?.lastSyncStatus ?? "No sync yet"}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <p className="text-sm font-medium text-slate-500">Device Details</p>
            <div className="mt-1 space-y-0.5">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">Model:</span> {device?.model ?? "—"}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                S/N: {device?.serialNumber ?? "—"}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Sync Stats */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Synced"
          value={syncedCount}
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Pending Sync"
          value={pendingCount}
          icon={Clock}
          iconClass="bg-amber-100 text-amber-600"
        />
        <StatCard
          title="Failed / Inactive"
          value={failedCount}
          icon={XCircle}
          iconClass="bg-red-100 text-red-600"
        />
      </div>

      {/* Employee Sync Table */}
      <Card className="mb-4">
        <CardBody className="p-4 sm:px-5 sm:py-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="section-title flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-brand-500" /> Employee Sync Status
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:bg-slate-800">
                {(["all", "synced", "pending", "failed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      statusFilter === f
                        ? "bg-brand-600 text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => handleAction(retryFailed, "retry")}
                disabled={actionLoading === "retry" || pendingCount === 0}
              >
                {actionLoading === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Retry Failed"}
              </Button>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">No employees match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left font-medium text-slate-500">Employee</th>
                    <th className="hidden pb-2 text-left font-medium text-slate-500 sm:table-cell">Employee ID</th>
                    <th className="hidden pb-2 text-left font-medium text-slate-500 md:table-cell">Device ID</th>
                    <th className="pb-2 text-left font-medium text-slate-500">Sync Status</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEmployees.map((emp) => {
                    const syncStatus = emp.deviceEmployeeId
                      ? "synced"
                      : emp.status === "active"
                        ? "pending"
                        : "failed";
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-slate-700 dark:text-slate-300">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.status}</p>
                        </td>
                        <td className="hidden py-2.5 pr-4 font-mono text-xs text-slate-600 sm:table-cell">{emp.employeeId}</td>
                        <td className="hidden py-2.5 pr-4 font-mono text-xs text-slate-600 md:table-cell">{emp.deviceEmployeeId ?? "—"}</td>
                        <td className="py-2.5 pr-4">
                          {syncStatus === "synced" && (
                            <Badge tone="green" dot>Synced</Badge>
                          )}
                          {syncStatus === "pending" && (
                            <Badge tone="amber" dot>Pending</Badge>
                          )}
                          {syncStatus === "failed" && (
                            <Badge tone="red" dot>Inactive</Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {syncStatus !== "synced" && emp.status === "active" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handleAction(
                                  () => syncSingleEmployee(emp.id),
                                  `sync-${emp.id}`
                                )
                              }
                              disabled={actionLoading === `sync-${emp.id}`}
                            >
                              {actionLoading === `sync-${emp.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Sync"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardBody className="p-4 sm:px-5 sm:py-4">
          <h3 className="section-title flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-brand-500" /> Sync Logs
          </h3>
          {logs.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">No sync logs yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left font-medium text-slate-500">Timestamp</th>
                    <th className="pb-2 text-left font-medium text-slate-500">Device</th>
                    <th className="pb-2 text-left font-medium text-slate-500">Type</th>
                    <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                    <th className="pb-2 text-left font-medium text-slate-500">Message</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Records</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-4 text-xs text-slate-500">
                        {formatDate(log.createdAt, "MMM d, HH:mm:ss")}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600">{log.device.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={log.type === "sync" ? "blue" : log.type === "pull" ? "indigo" : "gray"}>
                          {log.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        {log.status === "success" ? (
                          <Badge tone="green" dot>Success</Badge>
                        ) : (
                          <Badge tone="red" dot>Failed</Badge>
                        )}
                      </td>
                      <td className="max-w-xs truncate py-2.5 pr-4 text-xs text-slate-500">
                        {log.message ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-600">
                        {log.recordsSynced > 0 ? log.recordsSynced : "—"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-slate-600">
                        {log.duration != null ? `${log.duration}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
