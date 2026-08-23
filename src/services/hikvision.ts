import { createHash } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HikvisionDeviceConfig = {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  protocol?: "http" | "https";
};

export type HikvisionDeviceInfo = {
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  ipAddress: string;
  macAddress?: string;
  deviceName?: string;
};

export type HikvisionDeviceUser = {
  employeeNo: string;
  name: string;
  userType?: string;
  gender?: string;
};

export type HikvisionAttendanceEvent = {
  employeeNo: string;
  name?: string;
  time: string; // ISO 8601 e.g. "2026-08-23T09:58:45"
  verificationMode: string; // "fingerPrint", "face", "card", etc.
  attendanceStatus?: string; // "checkIn", "checkOut", "breakIn", "breakOut", "overtimeIn", "overtimeOut"
};

export type HikvisionSyncResult = {
  success: boolean;
  events: HikvisionAttendanceEvent[];
  totalMatches: number;
  numOfMatches: number;
  hasMore: boolean;
  error?: string;
};

export type HikvisionTestResult = {
  success: boolean;
  deviceInfo?: HikvisionDeviceInfo;
  error?: string;
  latencyMs?: number;
};

// ─── Digest Auth Helper ──────────────────────────────────────────────────────

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
  state: DigestState
): string {
  const ha1 = md5(`${username}:${state.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nc = String(state.nc).padStart(8, "0");
  const cnonce = md5(`${Date.now()}:${Math.random()}`);

  let response: string;
  if (state.qop) {
    response = md5(`${ha1}:${state.nonce}:${nc}:${cnonce}:${state.qop}:${ha2}`);
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
      case "realm": state.realm = val; break;
      case "nonce": state.nonce = val; break;
      case "qop": state.qop = val; break;
      case "opaque": state.opaque = val; break;
    }
  }
  return state;
}

// ─── Hikvision ISAPI Client ──────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 15000;

async function isapiRequest(
  config: HikvisionDeviceConfig,
  method: string,
  path: string,
  body?: string,
  attempt = 0
): Promise<Response> {
  const base = `${config.protocol ?? "http"}://${config.ipAddress}:${config.port}`;
  const url = `${base}${path}`;
  const timeout = DEFAULT_TIMEOUT;

  // First attempt: go straight to Digest (Hikvision devices reject Basic auth)
  if (attempt === 0) {
    // Get the Digest challenge
    const initialRes = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) } : {}),
      },
      body: body || undefined,
      signal: AbortSignal.timeout(timeout),
    });

    if (initialRes.status !== 401) {
      return initialRes;
    }

    const wwwAuth = initialRes.headers.get("www-authenticate");
    if (!wwwAuth?.startsWith("Digest")) {
      throw new Error("Device does not support Digest authentication");
    }

    const digestState = parseDigestChallenge(wwwAuth);
    const authHeader = buildDigestHeader(method, path, config.username, config.password, digestState);

    const authRes = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) } : {}),
      },
      body: body || undefined,
      signal: AbortSignal.timeout(timeout),
    });

    digestState.nc++;
    return authRes;
  }

  throw new Error("Too many auth attempts");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Test device connectivity and retrieve device info.
 */
export async function testDeviceConnection(
  config: HikvisionDeviceConfig
): Promise<HikvisionTestResult> {
  const start = Date.now();
  try {
    const res = await isapiRequest(config, "GET", "/ISAPI/System/deviceInfo?format=json");

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    const info = data?.DeviceInfo ?? data;
    return {
      success: true,
      latencyMs: Date.now() - start,
      deviceInfo: {
        model: info.model ?? "Unknown",
        serialNumber: info.serialNumber ?? "Unknown",
        firmwareVersion: info.firmwareVersion ?? "Unknown",
        ipAddress: info.ipAddress ?? config.ipAddress,
        macAddress: info.MACAddress,
        deviceName: info.deviceName,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).name === "TimeoutError"
        ? "Connection timed out — device may be offline or unreachable"
        : (e as Error).message,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Fetch device users (for employee mapping).
 */
export async function fetchDeviceUsers(
  config: HikvisionDeviceConfig
): Promise<HikvisionDeviceUser[]> {
  const users: HikvisionDeviceUser[] = [];
  let position = 0;
  const maxResults = 50;

  while (true) {
    const body = JSON.stringify({
      UserInfoSearchCond: {
        searchID: `user-search-${Date.now()}`,
        searchResultPosition: position,
        maxResults,
      },
    });

    const res = await isapiRequest(config, "POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", body);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`User search failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const info = data?.UserInfoSearch ?? data;
    const list = info?.UserInfo ?? [];

    for (const u of list) {
      users.push({
        employeeNo: u.employeeNoString ?? u.employeeNo ?? "",
        name: u.name ?? "",
        userType: u.userType,
        gender: u.gender,
      });
    }

    const total = parseInt(info?.totalMatches ?? "0", 10);
    position += list.length;

    if (position >= total || list.length === 0) break;
  }

  return users;
}

/**
 * Fetch attendance events from device using ISAPI AcsEvent.
 * Supports pagination for large datasets.
 */
export async function fetchAttendanceEvents(
  config: HikvisionDeviceConfig,
  startTime: Date,
  endTime: Date,
  lastSyncTime?: Date
): Promise<HikvisionSyncResult> {
  const events: HikvisionAttendanceEvent[] = [];
  let position = 0;
  const maxResults = 150; // Device max per request
  let totalMatches = 0;
  let hasMore = true;

  // Use lastSyncTime as start if provided (incremental sync)
  const effectiveStart = lastSyncTime && lastSyncTime > startTime ? lastSyncTime : startTime;

  const formatTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "");

  while (hasMore) {
    const body = JSON.stringify({
      AcsEventCond: {
        searchID: `sync-${Date.now()}`,
        searchResultPosition: position,
        maxResults,
        major: 5,
        minor: 0,
        startTime: formatTime(effectiveStart),
        endTime: formatTime(endTime),
      },
    });

    const res = await isapiRequest(config, "POST", "/ISAPI/AccessControl/AcsEvent?format=json", body);

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        events: [],
        totalMatches: 0,
        numOfMatches: 0,
        hasMore: false,
        error: `AcsEvent query failed: HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const data = await res.json();
    const acsEvent = data?.AcsEvent ?? data;
    totalMatches = parseInt(acsEvent?.totalMatches ?? "0", 10);
    const numOfMatches = parseInt(acsEvent?.numOfMatches ?? "0", 10);
    const list = acsEvent?.InfoList ?? [];

    for (const evt of list) {
      events.push({
        employeeNo: evt.employeeNoString ?? evt.employeeNo ?? "",
        name: evt.name,
        time: evt.time ?? "",
        verificationMode: evt.verifyMode ?? evt.currentVerifyMode ?? "unknown",
        attendanceStatus: mapAttendanceStatus(evt),
      });
    }

    position += numOfMatches;
    hasMore = acsEvent?.responseStatusStrg === "MORE" && position < totalMatches;
  }

  return {
    success: true,
    events,
    totalMatches,
    numOfMatches: events.length,
    hasMore: false,
  };
}

/**
 * Determine attendance status from event data.
 * The DS-K1A8503EF-B reports 6 attendance states:
 * Check In, Check Out, Break In, Break Out, Overtime In, Overtime Out.
 */
function mapAttendanceStatus(evt: any): string {
  // If device provides attendance status directly and it's not "undefined", use it
  if (evt.attendanceStatus && evt.attendanceStatus !== "undefined") {
    return evt.attendanceStatus;
  }

  // Map based on event minor type codes
  const minor = evt.minor;
  if (minor !== undefined) {
    switch (Number(minor)) {
      case 1: return "checkIn";       // Swipe
      case 2: return "checkIn";       // Password
      case 3: return "checkIn";       // Card
      case 4: return "checkIn";       // Fingerprint
      case 5: return "checkIn";       // Face
      case 21: return "checkOut";     // Door opened
      case 22: return "checkOut";     // Door closed
      case 38: return "checkIn";      // Face auth success
      case 49: return "checkIn";      // Fingerprint auth success
      case 75: return "checkIn";      // Face+Fingerprint auth
    }
  }

  // Fallback: classify by time of day heuristics
  const timeStr = evt.time ?? "";
  if (timeStr) {
    const hour = parseInt(timeStr.split("T")[1]?.split(":")[0] ?? "12", 10);
    if (hour < 10) return "checkIn";
    if (hour >= 17) return "checkOut";
    if (hour >= 12 && hour < 14) return "breakOut";
    return "checkIn";
  }

  return "checkIn";
}

/**
 * Get device status by querying deviceInfo.
 */
export async function getDeviceStatus(
  config: HikvisionDeviceConfig
): Promise<"online" | "offline" | "error"> {
  try {
    const res = await isapiRequest(config, "GET", "/ISAPI/System/deviceInfo?format=json");
    return res.ok ? "online" : "error";
  } catch {
    return "offline";
  }
}
