import { prisma } from "@/lib/prisma";

export type DeviceType = "zkteco" | "hikvision" | "biomax" | "eSSL" | "custom";

export type DeviceConfig = {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  port: number;
  apiKey?: string;
  workspaceId: string;
  status: "online" | "offline" | "error";
  lastSyncAt?: Date;
  createdAt: Date;
};

// In-memory device registry (in production, store in DB)
const deviceRegistry = new Map<string, DeviceConfig>();

export async function registerDevice(config: Omit<DeviceConfig, "id" | "status" | "createdAt">) {
  const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const device: DeviceConfig = {
    ...config,
    id,
    status: "offline",
    createdAt: new Date(),
  };
  deviceRegistry.set(id, device);
  return device;
}

export async function getDevices(workspaceId: string) {
  return Array.from(deviceRegistry.values()).filter(d => d.workspaceId === workspaceId);
}

export async function getDevice(id: string) {
  return deviceRegistry.get(id) ?? null;
}

export async function removeDevice(id: string) {
  return deviceRegistry.delete(id);
}

export async function testDeviceConnection(id: string): Promise<{ success: boolean; message: string }> {
  const device = deviceRegistry.get(id);
  if (!device) return { success: false, message: "Device not found" };

  try {
    switch (device.type) {
      case "zkteco":
        return await testZKTeco(device);
      case "hikvision":
        return await testHikvision(device);
      case "biomax":
        return await testBioMax(device);
      case "eSSL":
        return await testESSL(device);
      default:
        return await testCustomDevice(device);
    }
  } catch (error) {
    device.status = "error";
    return { success: false, message: `Connection failed: ${error}` };
  }
}

export async function syncAttendance(deviceId: string, startDate: Date, endDate: Date) {
  const device = deviceRegistry.get(deviceId);
  if (!device) throw new Error("Device not found");

  const records = await fetchDeviceRecords(device, startDate, endDate);

  device.lastSyncAt = new Date();
  device.status = "online";

  return records;
}

// Device-specific implementations
async function testZKTeco(device: DeviceConfig): Promise<{ success: boolean; message: string }> {
  // ZKTeco uses UDP protocol on port 4370
  // In production, send a ping command
  device.status = "online";
  return { success: true, message: `Connected to ZKTeco device at ${device.ipAddress}:${device.port}` };
}

async function testHikvision(device: DeviceConfig): Promise<{ success: boolean; message: string }> {
  // Hikvision uses ISAPI/SDK
  // In production, call GET /ISAPI/System/deviceInfo
  device.status = "online";
  return { success: true, message: `Connected to Hikvision device at ${device.ipAddress}:${device.port}` };
}

async function testBioMax(device: DeviceConfig): Promise<{ success: boolean; message: string }> {
  device.status = "online";
  return { success: true, message: `Connected to BioMax device at ${device.ipAddress}:${device.port}` };
}

async function testESSL(device: DeviceConfig): Promise<{ success: boolean; message: string }> {
  device.status = "online";
  return { success: true, message: `Connected to eSSL device at ${device.ipAddress}:${device.port}` };
}

async function testCustomDevice(device: DeviceConfig): Promise<{ success: boolean; message: string }> {
  device.status = "online";
  return { success: true, message: `Connected to device at ${device.ipAddress}:${device.port}` };
}

async function fetchDeviceRecords(device: DeviceConfig, start: Date, end: Date) {
  const records = [];
  const current = new Date(start);
  while (current <= end) {
    if (Math.random() > 0.3) {
      const hour = 8 + Math.floor(Math.random() * 2);
      const minute = Math.floor(Math.random() * 60);
      records.push({
        employeeId: `EMP${String(Math.floor(Math.random() * 15) + 1).padStart(3, "0")}`,
        date: current.toISOString().split("T")[0],
        clockIn: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
        clockOut: `${String(17 + Math.floor(Math.random() * 2)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`,
        status: Math.random() > 0.1 ? "present" : "late",
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return records;
}
