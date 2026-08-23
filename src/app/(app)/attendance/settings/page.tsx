"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Checkbox, Switch } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmationDialog } from "@/components/ui/modal";
import { Tabs, TabContent, useTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import {
  Clock,
  Wifi,
  Settings,
  Bell,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Monitor,
} from "lucide-react";
import {
  getAttendanceSettingsAction,
  updateAttendanceSettingsAction,
  getDevicesAction,
  testDeviceConnectionAction,
  syncDeviceAction,
  createDeviceAction,
  updateDeviceAction,
  deleteDeviceAction,
  getDeviceLogsAction,
} from "./actions";

const DAY_OPTIONS = [
  { value: "sun", label: "Sun" },
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
];

type SettingsData = {
  officeStartTime: string;
  officeEndTime: string;
  officeTimezone: string;
  graceMinutes: number;
  absentIfLateByMinutes: number;
  halfDayAfterMinutes: number;
  minimumWorkMinutes: number;
  workingDays: string;
  weekendDays: string;
  overtimeEnabled: boolean;
  overtimeRequiresApproval: boolean;
  overtimeRateMultiplier: number;
  weekendOvertimeRate: number;
  holidayOvertimeRate: number;
  breakEnabled: boolean;
  breakStartTime: string;
  breakEndTime: string;
  breakDurationMinutes: number;
  maxBreaksPerDay: number;
  breakIsPaid: boolean;
  remindersEnabled: boolean;
  reminderStartHour: string;
  reminderEndHour: string;
  maxRemindersPerDay: number;
  reminderEmailEnabled: boolean;
  lateDeductionEnabled: boolean;
  lateDeductionPerMinute: number;
  absentDeductionEnabled: boolean;
  halfDayDeductionPercent: number;
};

type DeviceData = {
  id: string;
  name: string;
  model: string | null;
  ipAddress: string;
  port: number;
  location: string | null;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  isActive: boolean;
  syncInterval: number;
  autoSync: boolean;
  firmwareVersion: string | null;
  serialNumber: string | null;
  errorMessage: string | null;
};

type DeviceLog = {
  id: string;
  type: string;
  status: string;
  message: string | null;
  recordsSynced: number;
  duration: number | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, { tone: "green" | "red" | "amber" | "blue"; label: string }> = {
  online: { tone: "green", label: "Online" },
  offline: { tone: "red", label: "Offline" },
  syncing: { tone: "amber", label: "Syncing" },
  error: { tone: "red", label: "Error" },
};

export default function AttendanceSettingsPage() {
  const { toast } = useToast();
  const tabs = useTabs("office-hours");

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceData | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    model: "",
    ipAddress: "",
    port: "4370",
    location: "",
    protocol: "TCP",
    username: "",
    password: "",
    syncInterval: "30",
    autoSync: false,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);

  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<Record<string, DeviceLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<string | null>(null);

  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const settingsRes = await getAttendanceSettingsAction();
      if (settingsRes.ok && settingsRes.data) {
        setSettings(settingsRes.data as SettingsData);
      }
      const devicesRes = await getDevicesAction();
      if (devicesRes.ok && devicesRes.data) {
        setDevices(devicesRes.data as DeviceData[]);
      }
    } catch {
      toast({ type: "error", title: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveOfficeHours = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await updateAttendanceSettingsAction({
        officeStartTime: settings.officeStartTime,
        officeEndTime: settings.officeEndTime,
        officeTimezone: settings.officeTimezone,
        graceMinutes: settings.graceMinutes,
        workingDays: settings.workingDays,
        weekendDays: settings.weekendDays,
      });
      if (res.ok) {
        toast({ type: "success", title: "Office hours updated" });
      } else {
        toast({ type: "error", title: res.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await updateAttendanceSettingsAction({
        absentIfLateByMinutes: settings.absentIfLateByMinutes,
        halfDayAfterMinutes: settings.halfDayAfterMinutes,
        minimumWorkMinutes: settings.minimumWorkMinutes,
        overtimeEnabled: settings.overtimeEnabled,
        overtimeRequiresApproval: settings.overtimeRequiresApproval,
        overtimeRateMultiplier: settings.overtimeRateMultiplier,
        weekendOvertimeRate: settings.weekendOvertimeRate,
        holidayOvertimeRate: settings.holidayOvertimeRate,
        breakEnabled: settings.breakEnabled,
        breakStartTime: settings.breakStartTime,
        breakEndTime: settings.breakEndTime,
        breakDurationMinutes: settings.breakDurationMinutes,
        maxBreaksPerDay: settings.maxBreaksPerDay,
        breakIsPaid: settings.breakIsPaid,
        lateDeductionEnabled: settings.lateDeductionEnabled,
        lateDeductionPerMinute: settings.lateDeductionPerMinute,
        absentDeductionEnabled: settings.absentDeductionEnabled,
        halfDayDeductionPercent: settings.halfDayDeductionPercent,
      });
      if (res.ok) {
        toast({ type: "success", title: "Rules updated" });
      } else {
        toast({ type: "error", title: res.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReminders = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await updateAttendanceSettingsAction({
        remindersEnabled: settings.remindersEnabled,
        reminderStartHour: settings.reminderStartHour,
        reminderEndHour: settings.reminderEndHour,
        maxRemindersPerDay: settings.maxRemindersPerDay,
        reminderEmailEnabled: settings.reminderEmailEnabled,
      });
      if (res.ok) {
        toast({ type: "success", title: "Reminder settings updated" });
      } else {
        toast({ type: "error", title: res.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (deviceId: string) => {
    setTestingDevice(deviceId);
    try {
      const res = await testDeviceConnectionAction(deviceId);
      const msg = res.ok ? (res.message || "Test complete") : res.error;
      toast({ type: res.ok ? "success" : "warning", title: msg });
      await fetchData();
    } finally {
      setTestingDevice(null);
    }
  };

  const handleSyncDevice = async (deviceId: string) => {
    setSyncingDevice(deviceId);
    try {
      const res = await syncDeviceAction(deviceId);
      const msg = res.ok ? (res.message || "Sync complete") : res.error;
      toast({ type: res.ok ? "success" : "error", title: msg });
      await fetchData();
    } finally {
      setSyncingDevice(null);
    }
  };

  const toggleWorkingDay = (day: string) => {
    if (!settings) return;
    const days: string[] = JSON.parse(settings.workingDays);
    const updated = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setSettings({ ...settings, workingDays: JSON.stringify(updated) });
  };

  const toggleWeekendDay = (day: string) => {
    if (!settings) return;
    const days: string[] = JSON.parse(settings.weekendDays);
    const updated = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setSettings({ ...settings, weekendDays: JSON.stringify(updated) });
  };

  const openCreateDevice = () => {
    setEditingDevice(null);
    setDeviceForm({
      name: "",
      model: "",
      ipAddress: "",
      port: "4370",
      location: "",
      protocol: "TCP",
      username: "",
      password: "",
      syncInterval: "30",
      autoSync: false,
    });
    setDeviceModalOpen(true);
  };

  const openEditDevice = (device: DeviceData) => {
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      model: device.model ?? "",
      ipAddress: device.ipAddress,
      port: String(device.port),
      location: device.location ?? "",
      protocol: "TCP",
      username: "",
      password: "",
      syncInterval: String(device.syncInterval),
      autoSync: device.autoSync,
    });
    setDeviceModalOpen(true);
  };

  const handleSaveDevice = async () => {
    setSaving(true);
    try {
      const payload = {
        name: deviceForm.name,
        model: deviceForm.model || undefined,
        ipAddress: deviceForm.ipAddress,
        port: parseInt(deviceForm.port, 10),
        location: deviceForm.location || undefined,
        protocol: deviceForm.protocol,
        username: deviceForm.username || undefined,
        password: deviceForm.password || undefined,
        syncInterval: parseInt(deviceForm.syncInterval, 10),
        autoSync: deviceForm.autoSync,
      };
      if (editingDevice) {
        const res = await updateDeviceAction(editingDevice.id, payload);
        if (res.ok) toast({ type: "success", title: "Device updated" });
        else toast({ type: "error", title: res.error });
      } else {
        const res = await createDeviceAction(payload);
        if (res.ok) toast({ type: "success", title: "Device created" });
        else toast({ type: "error", title: res.error });
      }
      setDeviceModalOpen(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deletingDeviceId) return;
    const res = await deleteDeviceAction(deletingDeviceId);
    if (res.ok) toast({ type: "success", title: "Device deleted" });
    else toast({ type: "error", title: res.error });
    setDeleteConfirmOpen(false);
    setDeletingDeviceId(null);
    await fetchData();
  };

  const toggleLogs = async (deviceId: string) => {
    if (expandedLogs === deviceId) {
      setExpandedLogs(null);
      return;
    }
    setExpandedLogs(deviceId);
    if (!deviceLogs[deviceId]) {
      setLogsLoading(deviceId);
      try {
        const res = await getDeviceLogsAction(deviceId);
        if (res.ok && res.data) {
          setDeviceLogs((prev) => ({ ...prev, [deviceId]: res.data as DeviceLog[] }));
        }
      } finally {
        setLogsLoading(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  const workingDays: string[] = settings ? JSON.parse(settings.workingDays) : [];
  const weekendDays: string[] = settings ? JSON.parse(settings.weekendDays) : [];

  const tabItems = [
    { value: "office-hours", label: "Office Hours", icon: <Clock className="h-4 w-4" /> },
    { value: "devices", label: "Devices", icon: <Monitor className="h-4 w-4" /> },
    { value: "rules", label: "Rules", icon: <Settings className="h-4 w-4" /> },
    { value: "reminders", label: "Reminders", icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Attendance Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure office hours, devices, rules, and reminders
        </p>
      </div>

      <Tabs items={tabItems} value={tabs.value} onChange={tabs.setValue} />

      <TabContent value="office-hours" active={tabs.value}>
        {settings && (
          <div className="space-y-6">
            <Card>
              <CardHeader title="Office Hours" subtitle="Set working hours and grace period" />
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Office Start Time"
                    type="time"
                    value={settings.officeStartTime}
                    onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                  />
                  <Input
                    label="Office End Time"
                    type="time"
                    value={settings.officeEndTime}
                    onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                  />
                  <Input
                    label="Grace Period (minutes)"
                    type="number"
                    min={0}
                    max={60}
                    value={settings.graceMinutes}
                    onChange={(e) =>
                      setSettings({ ...settings, graceMinutes: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Working Days" subtitle="Select which days are working days" />
              <CardBody>
                <div className="flex flex-wrap gap-3">
                  {DAY_OPTIONS.map((day) => (
                    <label
                      key={day.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 min-h-[44px]"
                    >
                      <input
                        type="checkbox"
                        checked={workingDays.includes(day.value)}
                        onChange={() => toggleWorkingDay(day.value)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {day.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Weekend Days" subtitle="Select which days are weekends" />
              <CardBody>
                <div className="flex flex-wrap gap-3">
                  {DAY_OPTIONS.map((day) => (
                    <label
                      key={day.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 min-h-[44px]"
                    >
                      <input
                        type="checkbox"
                        checked={weekendDays.includes(day.value)}
                        onChange={() => toggleWeekendDay(day.value)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {day.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveOfficeHours} loading={saving}>
                Save Office Hours
              </Button>
            </div>
          </div>
        )}
      </TabContent>

      <TabContent value="devices" active={tabs.value}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Attendance Devices
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage biometric devices and sync logs
              </p>
            </div>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateDevice}>
              Add Device
            </Button>
          </div>

          {devices.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <Monitor className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">No devices configured</p>
                <p className="mt-1 text-xs text-slate-400">
                  Add a biometric device to start syncing attendance
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => {
                const statusInfo = STATUS_BADGE[device.status] ?? STATUS_BADGE.offline;
                const isLogsExpanded = expandedLogs === device.id;
                const logs = deviceLogs[device.id] ?? [];

                return (
                  <Card key={device.id}>
                    <CardBody>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                            <Monitor className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {device.name}
                              </h3>
                              <Badge tone={statusInfo.tone} dot>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {device.model ?? "Unknown Model"} &middot; {device.ipAddress}:
                              {device.port}
                            </p>
                            {device.location && (
                              <p className="mt-0.5 text-xs text-slate-400">{device.location}</p>
                            )}
                            <p className="mt-0.5 text-xs text-slate-400">
                              Last sync:{" "}
                              {device.lastSyncAt ? formatDateTime(device.lastSyncAt) : "Never"}
                            </p>
                            {device.errorMessage && (
                              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {device.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={testingDevice === device.id}
                            onClick={() => handleTestConnection(device.id)}
                          >
                            <Wifi className="mr-1.5 h-3.5 w-3.5" />
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={syncingDevice === device.id}
                            onClick={() => handleSyncDevice(device.id)}
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Sync Now
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleLogs(device.id)}
                          >
                            <Activity className="mr-1.5 h-3.5 w-3.5" />
                            Logs
                            {isLogsExpanded ? (
                              <ChevronUp className="ml-1 h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="ml-1 h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDevice(device)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeletingDeviceId(device.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {isLogsExpanded && (
                        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                          {logsLoading === device.id ? (
                            <p className="text-sm text-slate-400">Loading logs...</p>
                          ) : logs.length === 0 ? (
                            <p className="text-sm text-slate-400">No sync logs yet</p>
                          ) : (
                            <div className="space-y-2">
                              {logs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
                                >
                                  {log.status === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                      {log.type.charAt(0).toUpperCase() + log.type.slice(1)} &mdash;{" "}
                                      {log.message ?? "No message"}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {formatDateTime(log.createdAt)}
                                      {log.recordsSynced > 0 && ` \u00b7 ${log.recordsSynced} records`}
                                      {log.duration && ` \u00b7 ${log.duration}ms`}
                                    </p>
                                  </div>
                                  <Badge
                                    tone={log.status === "success" ? "green" : "red"}
                                    className="shrink-0"
                                  >
                                    {log.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </TabContent>

      <TabContent value="rules" active={tabs.value}>
        {settings && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Late & Absent Rules"
                subtitle="Configure thresholds for late arrivals and absences"
              />
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Grace Period (minutes)"
                    type="number"
                    min={0}
                    value={settings.graceMinutes}
                    onChange={(e) =>
                      setSettings({ ...settings, graceMinutes: parseInt(e.target.value) || 0 })
                    }
                  />
                  <Input
                    label="Mark Absent After (minutes late)"
                    type="number"
                    min={0}
                    value={settings.absentIfLateByMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        absentIfLateByMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                    hint="0 = disabled"
                  />
                  <Input
                    label="Half Day After (minutes late)"
                    type="number"
                    min={0}
                    value={settings.halfDayAfterMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        halfDayAfterMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                    hint="0 = disabled"
                  />
                  <Input
                    label="Minimum Work Time (minutes)"
                    type="number"
                    min={0}
                    value={settings.minimumWorkMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        minimumWorkMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Overtime Settings"
                subtitle="Configure overtime rules and rate multipliers"
              />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.overtimeEnabled}
                      onCheckedChange={(v) => setSettings({ ...settings, overtimeEnabled: v })}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Enable Overtime
                      </p>
                      <p className="text-xs text-slate-500">Allow overtime tracking and calculation</p>
                    </div>
                  </div>
                  {settings.overtimeEnabled && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-10">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={settings.overtimeRequiresApproval}
                          onCheckedChange={(v) =>
                            setSettings({ ...settings, overtimeRequiresApproval: v })
                          }
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Requires Approval
                        </span>
                      </div>
                      <Input
                        label="Regular Rate Multiplier"
                        type="number"
                        min={0}
                        step={0.1}
                        value={settings.overtimeRateMultiplier}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            overtimeRateMultiplier: parseFloat(e.target.value) || 1.0,
                          })
                        }
                      />
                      <Input
                        label="Weekend Rate"
                        type="number"
                        min={0}
                        step={0.1}
                        value={settings.weekendOvertimeRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            weekendOvertimeRate: parseFloat(e.target.value) || 1.0,
                          })
                        }
                      />
                      <Input
                        label="Holiday Rate"
                        type="number"
                        min={0}
                        step={0.1}
                        value={settings.holidayOvertimeRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            holidayOvertimeRate: parseFloat(e.target.value) || 1.0,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Break Settings"
                subtitle="Configure break time rules"
              />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.breakEnabled}
                      onCheckedChange={(v) => setSettings({ ...settings, breakEnabled: v })}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Enable Breaks
                      </p>
                      <p className="text-xs text-slate-500">Track break times for employees</p>
                    </div>
                  </div>
                  {settings.breakEnabled && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-10">
                      <Input
                        label="Break Start"
                        type="time"
                        value={settings.breakStartTime ?? "12:00"}
                        onChange={(e) =>
                          setSettings({ ...settings, breakStartTime: e.target.value })
                        }
                      />
                      <Input
                        label="Break End"
                        type="time"
                        value={settings.breakEndTime ?? "13:00"}
                        onChange={(e) =>
                          setSettings({ ...settings, breakEndTime: e.target.value })
                        }
                      />
                      <Input
                        label="Break Duration (minutes)"
                        type="number"
                        min={0}
                        value={settings.breakDurationMinutes}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            breakDurationMinutes: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <Input
                        label="Max Breaks Per Day"
                        type="number"
                        min={1}
                        value={settings.maxBreaksPerDay}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            maxBreaksPerDay: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={settings.breakIsPaid}
                          onCheckedChange={(v) => setSettings({ ...settings, breakIsPaid: v })}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Paid Breaks
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Salary Deductions"
                subtitle="Configure deduction rules for payroll"
              />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.lateDeductionEnabled}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, lateDeductionEnabled: v })
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Late Deduction
                      </p>
                      <p className="text-xs text-slate-500">Deduct salary for late arrivals</p>
                    </div>
                  </div>
                  {settings.lateDeductionEnabled && (
                    <div className="pl-10">
                      <Input
                        label="Deduction Per Minute"
                        type="number"
                        min={0}
                        step={0.01}
                        value={settings.lateDeductionPerMinute}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            lateDeductionPerMinute: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.absentDeductionEnabled}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, absentDeductionEnabled: v })
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Absent Deduction
                      </p>
                      <p className="text-xs text-slate-500">Deduct salary for absent days</p>
                    </div>
                  </div>
                  <Input
                    label="Half-Day Deduction (%)"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.halfDayDeductionPercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        halfDayDeductionPercent: parseFloat(e.target.value) || 50,
                      })
                    }
                    className="max-w-xs"
                  />
                </div>
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveRules} loading={saving}>
                Save Rules
              </Button>
            </div>
          </div>
        )}
      </TabContent>

      <TabContent value="reminders" active={tabs.value}>
        {settings && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Attendance Reminders"
                subtitle="Configure automatic reminders for missing clock-ins/outs"
              />
              <CardBody>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.remindersEnabled}
                      onCheckedChange={(v) => setSettings({ ...settings, remindersEnabled: v })}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Enable Reminders
                      </p>
                      <p className="text-xs text-slate-500">
                        Send reminders to employees who forget to clock in/out
                      </p>
                    </div>
                  </div>
                  {settings.remindersEnabled && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-10">
                      <Input
                        label="Reminder Start Hour"
                        type="time"
                        value={settings.reminderStartHour}
                        onChange={(e) =>
                          setSettings({ ...settings, reminderStartHour: e.target.value })
                        }
                      />
                      <Input
                        label="Reminder End Hour"
                        type="time"
                        value={settings.reminderEndHour}
                        onChange={(e) =>
                          setSettings({ ...settings, reminderEndHour: e.target.value })
                        }
                      />
                      <Input
                        label="Max Reminders Per Day"
                        type="number"
                        min={1}
                        max={20}
                        value={settings.maxRemindersPerDay}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            maxRemindersPerDay: parseInt(e.target.value) || 8,
                          })
                        }
                      />
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={settings.reminderEmailEnabled}
                          onCheckedChange={(v) =>
                            setSettings({ ...settings, reminderEmailEnabled: v })
                          }
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Send via Email
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveReminders} loading={saving}>
                Save Reminder Settings
              </Button>
            </div>
          </div>
        )}
      </TabContent>

      <Modal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title={editingDevice ? "Edit Device" : "Add Device"}
        description="Configure your biometric attendance device"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeviceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDevice} loading={saving}>
              {editingDevice ? "Update Device" : "Add Device"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Device Name"
              value={deviceForm.name}
              onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
              placeholder="Main Entrance"
              required
            />
            <Input
              label="Model"
              value={deviceForm.model}
              onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })}
              placeholder="Hikvision DS-K1T502DBFW"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="IP Address"
              value={deviceForm.ipAddress}
              onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
              placeholder="192.168.1.100"
              required
            />
            <Input
              label="Port"
              type="number"
              value={deviceForm.port}
              onChange={(e) => setDeviceForm({ ...deviceForm, port: e.target.value })}
              placeholder="4370"
            />
            <Input
              label="Location"
              value={deviceForm.location}
              onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
              placeholder="Building A, Floor 1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Username"
              value={deviceForm.username}
              onChange={(e) => setDeviceForm({ ...deviceForm, username: e.target.value })}
              placeholder="admin"
            />
            <Input
              label="Password"
              type="password"
              value={deviceForm.password}
              onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Protocol"
              value={deviceForm.protocol}
              onChange={(e) => setDeviceForm({ ...deviceForm, protocol: e.target.value })}
              placeholder="TCP"
            />
            <Input
              label="Sync Interval (minutes)"
              type="number"
              min={5}
              value={deviceForm.syncInterval}
              onChange={(e) => setDeviceForm({ ...deviceForm, syncInterval: e.target.value })}
            />
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={deviceForm.autoSync}
                onCheckedChange={(v) => setDeviceForm({ ...deviceForm, autoSync: v })}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Auto Sync</span>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingDeviceId(null);
        }}
        onConfirm={handleDeleteDevice}
        title="Delete Device"
        description="Are you sure you want to delete this device? This action cannot be undone."
        confirmLabel="Delete Device"
        confirmVariant="danger"
      />
    </div>
  );
}
