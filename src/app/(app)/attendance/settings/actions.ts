"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { hasPermission, type PermissionAction } from "@/lib/permissions";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import {
  getAttendanceSettings,
  updateAttendanceSettings,
  type AttendanceSettingsData,
} from "@/services/attendance-settings";
import { hasPermission as checkPermission } from "@/lib/permissions";
import {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  testConnection,
  syncDevice,
  getDeviceLogs,
  fetchDeviceUserList,
  mapDeviceEmployee,
  getUnmappedEmployees,
  getMappedEmployees,
  type DeviceInput,
} from "@/services/attendance-device";

async function requirePerm(module: string, action: PermissionAction = "view") {
  const session = await requireSession();
  if (!hasPermission(session, module, action)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getDevicePermissionAction(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const allowed = checkPermission(session, "attendance", "device");
    return ok({ allowed });
  } catch (e) {
    return fail((e as Error).message || "Failed to check permission");
  }
}

export async function getDevicesAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const devices = await getDevices(session.workspaceId);
    return ok(devices);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch devices");
  }
}

export async function getAttendanceSettingsAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "view");
    const settings = await getAttendanceSettings(session.workspaceId);
    return ok(settings);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch attendance settings");
  }
}

export async function updateAttendanceSettingsAction(
  formData: Record<string, string | boolean | number>
): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "edit");
    const data: Partial<AttendanceSettingsData> = {};

    const stringFields: (keyof AttendanceSettingsData)[] = [
      "officeStartTime",
      "officeEndTime",
      "officeTimezone",
      "workingDays",
      "weekendDays",
      "breakStartTime",
      "breakEndTime",
      "reminderStartHour",
      "reminderEndHour",
    ];
    const intFields: (keyof AttendanceSettingsData)[] = [
      "graceMinutes",
      "absentIfLateByMinutes",
      "halfDayAfterMinutes",
      "minimumWorkMinutes",
      "breakDurationMinutes",
      "maxBreaksPerDay",
      "maxRemindersPerDay",
    ];
    const floatFields: (keyof AttendanceSettingsData)[] = [
      "overtimeRateMultiplier",
      "weekendOvertimeRate",
      "holidayOvertimeRate",
      "lateDeductionPerMinute",
      "halfDayDeductionPercent",
    ];
    const boolFields: (keyof AttendanceSettingsData)[] = [
      "overtimeEnabled",
      "overtimeRequiresApproval",
      "breakEnabled",
      "breakIsPaid",
      "remindersEnabled",
      "reminderEmailEnabled",
      "lateDeductionEnabled",
      "absentDeductionEnabled",
    ];

    for (const field of stringFields) {
      if (field in formData) {
        (data as Record<string, unknown>)[field] = String(formData[field]);
      }
    }
    for (const field of intFields) {
      if (field in formData) {
        (data as Record<string, unknown>)[field] = parseInt(String(formData[field]), 10);
      }
    }
    for (const field of floatFields) {
      if (field in formData) {
        (data as Record<string, unknown>)[field] = parseFloat(String(formData[field]));
      }
    }
    for (const field of boolFields) {
      if (field in formData) {
        (data as Record<string, unknown>)[field] =
          formData[field] === true || formData[field] === "true" || formData[field] === "on";
      }
    }

    const updated = await updateAttendanceSettings(session.workspaceId, data);
    await writeAudit({
      session,
      action: "edit",
      module: "attendance",
      description: "Updated attendance settings",
      after: data,
    });
    revalidatePath("/attendance/settings");
    return ok(updated, "Settings updated");
  } catch (e) {
    return fail((e as Error).message || "Failed to update settings");
  }
}

export async function testDeviceConnectionAction(deviceId: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const result = await testConnection(deviceId);
    const device = await getDevice(deviceId);
    await writeAudit({
      session,
      action: "edit",
      module: "attendance",
      description: `Tested connection for device ${device?.name ?? deviceId}`,
    });
    revalidatePath("/attendance/settings");
    return ok(result, result.success ? "Connection successful" : "Connection failed");
  } catch (e) {
    return fail((e as Error).message || "Failed to test connection");
  }
}

export async function syncDeviceAction(deviceId: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const result = await syncDevice(deviceId);
    const device = await getDevice(deviceId);
    await writeAudit({
      session,
      action: "create",
      module: "attendance",
      description: `Synced device ${device?.name ?? deviceId}: ${result.newRecords} new, ${result.duplicates} duplicates, ${result.unmapped} unmapped`,
    });
    revalidatePath("/attendance/settings");
    revalidatePath("/attendance");
    return ok(result, result.message);
  } catch (e) {
    return fail((e as Error).message || "Failed to sync device");
  }
}

export async function createDeviceAction(formData: DeviceInput): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const device = await createDevice(session.workspaceId, formData);
    await writeAudit({
      session,
      action: "create",
      module: "attendance",
      description: `Created device ${formData.name}`,
    });
    revalidatePath("/attendance/settings");
    return ok(device, "Device created");
  } catch (e) {
    return fail((e as Error).message || "Failed to create device");
  }
}

export async function updateDeviceAction(
  deviceId: string,
  formData: Partial<DeviceInput>
): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const device = await updateDevice(deviceId, formData);
    await writeAudit({
      session,
      action: "edit",
      module: "attendance",
      description: `Updated device ${formData.name ?? deviceId}`,
    });
    revalidatePath("/attendance/settings");
    return ok(device, "Device updated");
  } catch (e) {
    return fail((e as Error).message || "Failed to update device");
  }
}

export async function deleteDeviceAction(deviceId: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const device = await getDevice(deviceId);
    await deleteDevice(deviceId);
    await writeAudit({
      session,
      action: "delete",
      module: "attendance",
      description: `Deleted device ${device?.name ?? deviceId}`,
    });
    revalidatePath("/attendance/settings");
    return ok(undefined, "Device deleted");
  } catch (e) {
    return fail((e as Error).message || "Failed to delete device");
  }
}

export async function getDeviceLogsAction(deviceId: string): Promise<ActionResult> {
  try {
    await requirePerm("attendance", "device");
    const logs = await getDeviceLogs(deviceId, 30);
    return ok(logs);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch logs");
  }
}

// ─── Employee-Device Mapping ─────────────────────────────────────────────────

export async function fetchDeviceUsersAction(deviceId: string): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const users = await fetchDeviceUserList(deviceId);
    return ok(users);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch device users");
  }
}

export async function mapEmployeeToDeviceAction(
  employeeId: string,
  deviceUserId: string
): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    await mapDeviceEmployee(employeeId, deviceUserId);
    await writeAudit({
      session,
      action: "edit",
      module: "attendance",
      description: `Mapped employee ${employeeId} to device user ${deviceUserId}`,
    });
    revalidatePath("/attendance/settings");
    return ok(undefined, "Employee mapped to device user");
  } catch (e) {
    return fail((e as Error).message || "Failed to map employee");
  }
}

export async function getUnmappedEmployeesAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const employees = await getUnmappedEmployees(session.workspaceId);
    return ok(employees);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch unmapped employees");
  }
}

export async function getMappedEmployeesAction(): Promise<ActionResult> {
  try {
    const session = await requirePerm("attendance", "device");
    const employees = await getMappedEmployees(session.workspaceId);
    return ok(employees);
  } catch (e) {
    return fail((e as Error).message || "Failed to fetch mapped employees");
  }
}
