"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  addDeviceAction,
  listDevicesAction,
  removeDeviceAction,
  testDeviceAction,
  syncDeviceAction,
} from "./device-actions";
import type { DeviceType } from "@/services/attendance-devices";
import {
  Cpu,
  Wifi,
  RefreshCw,
  Trash2,
  Plus,
  Server,
  Key,
  Globe,
} from "lucide-react";

type Device = {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  port: number;
  apiKey?: string;
  workspaceId: string;
  status: "online" | "offline" | "error";
  lastSyncAt?: string;
  createdAt: string;
};

const DEVICE_TYPES: { value: DeviceType; label: string; description: string; icon: string }[] = [
  { value: "zkteco", label: "ZKTeco", description: "Fingerprint & facial recognition terminals", icon: "🔐" },
  { value: "hikvision", label: "Hikvision", description: "DeepinView & FacePro series", icon: "📷" },
  { value: "biomax", label: "BioMax", description: "Biometric access control systems", icon: "🖐️" },
  { value: "eSSL", label: "eSSL", description: "Time attendance & access control", icon: "🕐" },
  { value: "custom", label: "Custom", description: "Other devices with compatible APIs", icon: "⚙️" },
];

const DEFAULT_PORTS: Record<DeviceType, number> = {
  zkteco: 4370,
  hikvision: 80,
  biomax: 80,
  eSSL: 80,
  custom: 80,
};

function StatusIndicator({ status }: { status: Device["status"] }) {
  return (
    <span className="relative flex h-3 w-3">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
          status === "online"
            ? "bg-emerald-400"
            : status === "error"
            ? "bg-red-400"
            : "bg-slate-400"
        }`}
      />
      <span
        className={`relative inline-flex h-3 w-3 rounded-full ${
          status === "online"
            ? "bg-emerald-500"
            : status === "error"
            ? "bg-red-500"
            : "bg-slate-400"
        }`}
      />
    </span>
  );
}

function DeviceCard({
  device,
  onTest,
  onSync,
  onRemove,
  testingId,
  syncingId,
}: {
  device: Device;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onRemove: (id: string) => void;
  testingId: string | null;
  syncingId: string | null;
}) {
  const deviceType = DEVICE_TYPES.find((d) => d.value === device.type);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl dark:bg-slate-700">
          {deviceType?.icon ?? "⚙️"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{device.name}</h4>
            <StatusIndicator status={device.status} />
            <Badge tone={device.status === "online" ? "green" : device.status === "error" ? "red" : "gray"}>
              {device.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {device.ipAddress}:{device.port}
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {deviceType?.label ?? device.type}
            </span>
            {device.lastSyncAt && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Last sync: {new Date(device.lastSyncAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Wifi className="h-3.5 w-3.5" />}
          onClick={() => onTest(device.id)}
          loading={testingId === device.id}
        >
          Test
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => onSync(device.id)}
          loading={syncingId === device.id}
        >
          Sync
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => onRemove(device.id)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function AddDeviceForm({ onSubmit, onClose, loading }: {
  onSubmit: (data: { name: string; type: DeviceType; ipAddress: string; port: number; apiKey?: string }) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("zkteco");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(String(DEFAULT_PORTS.zkteco));
  const [apiKey, setApiKey] = useState("");

  const handleTypeChange = (newType: DeviceType) => {
    setType(newType);
    setPort(String(DEFAULT_PORTS[newType]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, type, ipAddress, port: Number(port), apiKey: apiKey || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Device Name"
        placeholder="e.g. Main Entrance Device"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <Select label="Device Type" value={type} onChange={(e) => handleTypeChange(e.target.value as DeviceType)}>
        {DEVICE_TYPES.map((dt) => (
          <option key={dt.value} value={dt.value}>
            {dt.icon} {dt.label} - {dt.description}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="IP Address"
          placeholder="192.168.1.100"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          required
          leftIcon={<Globe className="h-4 w-4" />}
        />
        <Input
          label="Port"
          placeholder={String(DEFAULT_PORTS[type])}
          value={port}
          onChange={(e) => setPort(e.target.value)}
          type="number"
          required
          leftIcon={<Server className="h-4 w-4" />}
        />
      </div>

      <Input
        label="API Key (Optional)"
        placeholder="Enter API key if required"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        leftIcon={<Key className="h-4 w-4" />}
        hint="Required for some devices to authenticate"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} leftIcon={<Plus className="h-4 w-4" />}>
          Add Device
        </Button>
      </div>
    </form>
  );
}

export function DeviceManager() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const result = await listDevicesAction();
    if (result.ok) {
      setDevices((result.data as unknown as Device[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleAddDevice = async (data: {
    name: string;
    type: DeviceType;
    ipAddress: string;
    port: number;
    apiKey?: string;
  }) => {
    setAddLoading(true);
    const result = await addDeviceAction(data);
    setAddLoading(false);

    if (result.ok) {
      toast({ type: "success", title: result.message ?? "Device added" });
      setShowAddModal(false);
      fetchDevices();
    } else {
      toast({ type: "error", title: result.error });
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    const result = await testDeviceAction(id);
    setTestingId(null);

    if (result.ok) {
      toast({ type: "success", title: result.message ?? "Connected" });
      fetchDevices();
    } else {
      toast({ type: "error", title: result.error });
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const result = await syncDeviceAction(id, startDate, endDate);
    setSyncingId(null);

    if (result.ok) {
      const data = result.data as { recordCount: number } | undefined;
      toast({
        type: "success",
        title: result.message ?? "Synced",
        description: data?.recordCount ? `${data.recordCount} records synced` : undefined,
      });
      fetchDevices();
    } else {
      toast({ type: "error", title: result.error });
    }
  };

  const handleRemove = async (id: string) => {
    const result = await removeDeviceAction(id);
    if (result.ok) {
      toast({ type: "success", title: "Device removed" });
      fetchDevices();
    } else {
      toast({ type: "error", title: result.error });
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Attendance Devices"
          subtitle="Connect physical biometric devices to sync attendance data"
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
              Add Device
            </Button>
          }
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <Cpu className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No devices connected</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Add an attendance device to start syncing biometric data
                </p>
              </div>
              <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
                Add your first device
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 p-2">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onTest={handleTestConnection}
                  onSync={handleSync}
                  onRemove={handleRemove}
                  testingId={testingId}
                  syncingId={syncingId}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Attendance Device"
        description="Connect a biometric device to sync attendance records automatically"
        size="lg"
      >
        <AddDeviceForm onSubmit={handleAddDevice} onClose={() => setShowAddModal(false)} loading={addLoading} />
      </Modal>
    </>
  );
}
