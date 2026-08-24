import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  type HikvisionDeviceConfig,
  type HikvisionDeviceUser,
} from "./hikvision";

// ─── Digest Auth Helpers (copied from hikvision.ts — not exported there) ────

type DigestState = {
  realm?: string;
  nonce?: string;
  qop?: string;
  opaque?: string;
  nc: number;
};

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

function buildDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  state: DigestState,
): string {
  const ha1 = md5(`${username}:${state.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nc = String(state.nc).padStart(8, "0");
  const cnonce = md5(`${Date.now()}:${Math.random()}`);

  let response: string;
  if (state.qop) {
    response = md5(
      `${ha1}:${state.nonce}:${nc}:${cnonce}:${state.qop}:${ha2}`,
    );
    return `Digest username="${username}", realm="${state.realm}", nonce="${state.nonce}", uri="${uri}", qop=${state.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}", opaque="${state.opaque}"`;
  } else {
    response = md5(`${ha1}:${state.nonce}:${ha2}`);
    return `Digest username="${username}", realm="${state.realm}", nonce="${state.nonce}", uri="${uri}", response="${response}"`;
  }
}

function parseDigestChallenge(header: string): DigestState {
  const state: DigestState = { nc: 1 };
  const parts = header.replace("Digest ", "").split(",");
  for (const part of parts) {
    const [key, ...valParts] = part.split("=");
    const val = valParts.join("=").replace(/"/g, "").trim();
    switch (key.trim()) {
      case "realm":
        state.realm = val;
        break;
      case "nonce":
        state.nonce = val;
        break;
      case "qop":
        state.qop = val;
        break;
      case "opaque":
        state.opaque = val;
        break;
    }
  }
  return state;
}

// ─── ISAPI Request ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 15000;

async function isapiRequest(
  config: HikvisionDeviceConfig,
  method: string,
  path: string,
  body?: string,
  attempt = 0,
): Promise<Response> {
  const base = `${config.protocol ?? "http"}://${config.ipAddress}:${config.port}`;
  const url = `${base}${path}`;

  if (attempt === 0) {
    const initialRes = await fetch(url, {
      method,
      headers: {
        ...(body
          ? {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(body)),
            }
          : {}),
      },
      body: body || undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (initialRes.status !== 401) {
      return initialRes;
    }

    const wwwAuth = initialRes.headers.get("www-authenticate");
    if (!wwwAuth?.startsWith("Digest")) {
      throw new Error("Device does not support Digest authentication");
    }

    const digestState = parseDigestChallenge(wwwAuth);
    const authHeader = buildDigestHeader(
      method,
      path,
      config.username,
      config.password,
      digestState,
    );

    const authRes = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body
          ? {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(body)),
            }
          : {}),
      },
      body: body || undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    digestState.nc++;
    return authRes;
  }

  throw new Error("Too many auth attempts");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeviceSyncResult = {
  success: boolean;
  message: string;
};

export type DeviceSyncStatus = {
  employeeId: string;
  employeeName: string;
  deviceEmployeeId: string | null;
  syncStatus: "synced" | "pending" | "failed";
  lastSyncAttempt?: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDeviceConfig(
  deviceId: string,
): Promise<HikvisionDeviceConfig> {
  const device = await prisma.attendanceDevice.findUniqueOrThrow({
    where: { id: deviceId },
  });

  if (!device.username || !device.password) {
    throw new Error(
      `Device "${device.name}" is missing credentials (username/password)`,
    );
  }

  return {
    ipAddress: device.ipAddress,
    port: device.port,
    username: device.username,
    password: device.password,
    protocol: "http",
  };
}

async function createDeviceLog(
  deviceId: string,
  type: string,
  status: string,
  message: string,
  recordsSynced = 0,
  duration?: number,
) {
  return prisma.attendanceDeviceLog.create({
    data: {
      deviceId,
      type,
      status,
      message,
      recordsSynced,
      duration: duration ?? null,
    },
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a user on the Hikvision device via ISAPI.
 */
export async function createDeviceUser(
  config: HikvisionDeviceConfig,
  employeeNo: string,
  name: string,
): Promise<void> {
  const body = JSON.stringify({
    UserInfo: {
      employeeNoString: employeeNo,
      name,
      userType: "normal",
      Valid: {
        enable: true,
        beginTime: "2024-01-01T00:00:00",
        endTime: "2037-12-31T23:59:59",
        timeType: "byDay",
      },
    },
  });

  const res = await isapiRequest(
    config,
    "POST",
    "/ISAPI/AccessControl/UserInfo/Record?format=json",
    body,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to create device user "${employeeNo}": HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }
}

/**
 * Delete a user from the Hikvision device via ISAPI.
 */
export async function deleteDeviceUser(
  config: HikvisionDeviceConfig,
  employeeNo: string,
): Promise<void> {
  const body = JSON.stringify({
    UserInfo: {
      employeeNoString: employeeNo,
    },
  });

  const res = await isapiRequest(
    config,
    "PUT",
    "/ISAPI/AccessControl/UserInfo/Delete?format=json",
    body,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to delete device user "${employeeNo}": HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }
}

/**
 * Update a user on the Hikvision device via ISAPI.
 */
export async function updateDeviceUser(
  config: HikvisionDeviceConfig,
  employeeNo: string,
  name: string,
): Promise<void> {
  const body = JSON.stringify({
    UserInfo: {
      employeeNoString: employeeNo,
      name,
      userType: "normal",
      Valid: {
        enable: true,
        beginTime: "2024-01-01T00:00:00",
        endTime: "2037-12-31T23:59:59",
        timeType: "byDay",
      },
    },
  });

  const res = await isapiRequest(
    config,
    "PUT",
    "/ISAPI/AccessControl/UserInfo/Update?format=json",
    body,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to update device user "${employeeNo}": HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }
}

/**
 * Full sync: create user on device, update employee record, create device log.
 */
export async function syncEmployeeToDevice(
  employee: { id: string; employeeId: string; name: string },
  deviceId: string,
): Promise<DeviceSyncResult> {
  const start = Date.now();

  try {
    const config = await getDeviceConfig(deviceId);

    await createDeviceUser(config, employee.employeeId, employee.name);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { deviceEmployeeId: employee.employeeId },
    });

    await createDeviceLog(
      deviceId,
      "sync",
      "success",
      `Synced employee ${employee.employeeId} (${employee.name}) to device`,
      1,
      Date.now() - start,
    );

    return { success: true, message: `Employee ${employee.employeeId} synced successfully` };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";

    await createDeviceLog(
      deviceId,
      "sync",
      "failed",
      `Failed to sync employee ${employee.employeeId}: ${message}`,
      0,
      Date.now() - start,
    ).catch(() => {});

    return { success: false, message };
  }
}

/**
 * Remove an employee from the device and clear deviceEmployeeId.
 */
export async function unsyncEmployeeFromDevice(
  employeeId: string,
): Promise<DeviceSyncResult> {
  try {
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: { workspace: { include: { attendanceDevices: true } } },
    });

    if (!employee.deviceEmployeeId) {
      return { success: false, message: "Employee is not synced to any device" };
    }

    const device = employee.workspace.attendanceDevices.find(
      (d) => d.isActive,
    );
    if (!device) {
      return { success: false, message: "No active device found for workspace" };
    }

    const config = await getDeviceConfig(device.id);
    await deleteDeviceUser(config, employee.deviceEmployeeId);

    await prisma.employee.update({
      where: { id: employeeId },
      data: { deviceEmployeeId: null },
    });

    await createDeviceLog(
      device.id,
      "unsync",
      "success",
      `Removed employee ${employee.deviceEmployeeId} from device`,
    );

    return { success: true, message: "Employee removed from device" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown unsync error";
    return { success: false, message };
  }
}

/**
 * Get sync status for all employees in a workspace.
 */
export async function getDeviceSyncStatus(
  workspaceId: string,
): Promise<DeviceSyncStatus[]> {
  const employees = await prisma.employee.findMany({
    where: { workspaceId },
    orderBy: { employeeId: "asc" },
  });

  return employees.map((emp) => ({
    employeeId: emp.employeeId,
    employeeName: emp.name,
    deviceEmployeeId: emp.deviceEmployeeId,
    syncStatus: emp.deviceEmployeeId
      ? ("synced" as const)
      : emp.status === "active"
        ? ("pending" as const)
        : ("failed" as const),
  }));
}

/**
 * Retry all failed syncs for a workspace.
 */
export async function retryFailedSyncs(
  workspaceId: string,
): Promise<DeviceSyncResult> {
  const employees = await prisma.employee.findMany({
    where: {
      workspaceId,
      deviceEmployeeId: null,
      status: "active",
    },
  });

  if (employees.length === 0) {
    return { success: true, message: "No employees to sync" };
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId, isActive: true },
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

  return {
    success: failed === 0,
    message: `Synced ${synced}/${employees.length} employees (${failed} failed)`,
  };
}
