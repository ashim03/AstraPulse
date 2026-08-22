"use server";

import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { registerDevice, getDevices, removeDevice, testDeviceConnection, syncAttendance } from "@/services/attendance-devices";
import type { DeviceType, DeviceConfig } from "@/services/attendance-devices";

export async function addDeviceAction(input: {
  name: string;
  type: DeviceType;
  ipAddress: string;
  port: number;
  apiKey?: string;
}): Promise<ActionResult<DeviceConfig>> {
  const session = await requireSession();

  const device = await registerDevice({
    name: input.name,
    type: input.type,
    ipAddress: input.ipAddress,
    port: input.port,
    apiKey: input.apiKey,
    workspaceId: session.workspaceId,
  });

  revalidatePath("/attendance");
  return ok(device, "Device registered successfully");
}

export async function listDevicesAction(): Promise<ActionResult<DeviceConfig[]>> {
  const session = await requireSession();
  const devices = await getDevices(session.workspaceId);
  return ok(devices);
}

export async function removeDeviceAction(deviceId: string): Promise<ActionResult> {
  const session = await requireSession();
  await removeDevice(deviceId);
  revalidatePath("/attendance");
  return ok(undefined, "Device removed");
}

export async function testDeviceAction(deviceId: string): Promise<ActionResult<{ success: boolean; message: string }>> {
  const session = await requireSession();
  const result = await testDeviceConnection(deviceId);
  revalidatePath("/attendance");
  return result.success ? ok(result, result.message) : fail(result.message);
}

export async function syncDeviceAction(
  deviceId: string,
  startDate: string,
  endDate: string
): Promise<ActionResult<{ recordCount: number; records: unknown[] }>> {
  const session = await requireSession();
  const records = await syncAttendance(deviceId, new Date(startDate), new Date(endDate));

  revalidatePath("/attendance");
  return ok({ recordCount: records.length, records }, `Synced ${records.length} attendance records`);
}
