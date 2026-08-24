"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  syncEmployeeToDevice,
  retryFailedSyncs,
  getDeviceSyncStatus,
  type DeviceSyncResult,
} from "@/services/device-sync";
import { syncDevice } from "@/services/attendance-device";

export type ActionResponse = {
  success: boolean;
  message: string;
};

/**
 * Sync a single employee to the attendance device.
 */
export async function syncSingleEmployee(employeeId: string): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId, workspaceId: session.workspaceId },
    select: { id: true, employeeId: true, name: true },
  });

  if (!employee) {
    return { success: false, message: "Employee not found" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found. Configure a device first." };
  }

  const result = await syncEmployeeToDevice(employee, device.id);
  revalidatePath("/staff/device-sync");
  return result;
}

/**
 * Sync all active employees to the attendance device.
 */
export async function syncAllEmployees(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const result = await retryFailedSyncs(session.workspaceId);
  revalidatePath("/staff/device-sync");
  return result;
}

/**
 * Retry only failed syncs (employees without deviceEmployeeId).
 */
export async function retryFailed(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const employees = await prisma.employee.findMany({
    where: {
      workspaceId: session.workspaceId,
      deviceEmployeeId: null,
      status: "active",
    },
  });

  if (employees.length === 0) {
    return { success: true, message: "No failed syncs to retry" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found" };
  }

  let synced = 0;
  let failed = 0;

  for (const emp of employees) {
    const result = await syncEmployeeToDevice(
      { id: emp.id, employeeId: emp.employeeId, name: emp.name },
      device.id,
    );
    if (result.success) synced++;
    else failed++;
  }

  revalidatePath("/staff/device-sync");
  return {
    success: failed === 0,
    message: `Retried: ${synced}/${employees.length} synced (${failed} failed)`,
  };
}

/**
 * Pull attendance records from the device (manual trigger).
 */
export async function pullAttendance(): Promise<ActionResponse> {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return { success: false, message: "Access denied" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: session.workspaceId, isActive: true },
  });

  if (!device) {
    return { success: false, message: "No active device found" };
  }

  try {
    const result = await syncDevice(device.id);
    revalidatePath("/staff/device-sync");
    revalidatePath("/attendance");
    return {
      success: result.success,
      message: result.success
        ? `Pulled ${result.recordsRetrieved} records: ${result.newRecords} new, ${result.duplicates} duplicates, ${result.unmapped} unmapped`
        : result.message,
    };
  } catch (e: any) {
    return { success: false, message: `Pull failed: ${e.message}` };
  }
}

/**
 * Get device sync overview data for the page.
 */
export async function getDeviceSyncData() {
  const session = await requireSession();
  if (!hasPermission(session, "attendance", "device")) {
    return null;
  }

  const [device, employees, syncStatuses, logs] = await Promise.all([
    prisma.attendanceDevice.findFirst({
      where: { workspaceId: session.workspaceId, isActive: true },
    }),
    prisma.employee.findMany({
      where: { workspaceId: session.workspaceId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
        deviceEmployeeId: true,
      },
      orderBy: { employeeId: "asc" },
    }),
    getDeviceSyncStatus(session.workspaceId),
    prisma.attendanceDeviceLog.findMany({
      where: {
        device: { workspaceId: session.workspaceId },
      },
      include: { device: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const failedSyncLogs = await prisma.attendanceDeviceLog.count({
    where: {
      device: { workspaceId: session.workspaceId },
      status: "failed",
    },
  });

  const deviceOnline = device?.status === "online";

  return {
    device,
    employees,
    syncStatuses,
    logs,
    deviceOnline,
    failedSyncLogs,
  };
}
