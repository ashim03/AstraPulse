/**
 * Hikvision Device Poller — run locally to sync attendance from the device.
 *
 * Rules (Nepal UTC+5:45):
 *   Office: 9:30 AM – 5:30 PM
 *   Grace: 10 min (check-in ≤ 9:40 = Present, > 9:40 = Absent)
 *   OT threshold: 5:35 PM (check-out > 5:35 = Overtime)
 *   Break: max 35 min, once per day
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const http = require('http');

// ─── Config ──────────────────────────────────────────────────────────────────

const DEVICE_IP = '192.168.1.64';
const DEVICE_PORT = 80;
const DEVICE_USER = 'admin';
const DEVICE_PASS = 'Aicnepal@0012!';
const WORKSPACE_ID = 'cmt5sjd04000062bm41d445cb';
const POLL_INTERVAL_MS = 15 * 60 * 1000;
const FETCH_DAYS = 7;

// Office hours in Nepal minutes from midnight
const OFFICE_START = 9 * 60 + 30;   // 9:30 AM = 570
const OFFICE_END = 17 * 60 + 30;    // 5:30 PM = 1050
const GRACE_DEADLINE = OFFICE_START + 10; // 9:40 AM = 580
const OT_THRESHOLD = OFFICE_END + 5;      // 5:35 PM = 1055

const prisma = new PrismaClient();

// ─── ISAPI Digest Auth ───────────────────────────────────────────────────────

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function rawReq(path, headers = {}, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: DEVICE_IP, port: DEVICE_PORT, path, headers, method, timeout: 15000 };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body !== null && body !== undefined) req.write(body);
    req.end();
  });
}

async function digestRequest(method, uri, body = null) {
  const initHeaders = {};
  if (body) {
    initHeaders['Content-Type'] = 'application/json';
    initHeaders['Content-Length'] = Buffer.byteLength(body).toString();
  }
  const r0 = await rawReq(uri, initHeaders, method, body);
  if (r0.status === 200 || r0.status === 207) return r0;
  const wwwAuth = r0.headers['www-authenticate'];
  if (!wwwAuth?.includes('Digest')) throw new Error('No Digest challenge');
  const realm = wwwAuth.match(/realm="([^"]+)"/)[1];
  const nonce = wwwAuth.match(/nonce="([^"]+)"/)[1];
  const qop = wwwAuth.match(/qop="([^"]+)"/)[1] || 'auth';
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = md5(DEVICE_USER + ':' + realm + ':' + DEVICE_PASS);
  const ha2 = md5(method + ':' + uri);
  const response = md5(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2);
  const authHeader = `Digest username="${DEVICE_USER}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", algorithm=MD5`;
  const headers = { 'Authorization': authHeader };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body).toString();
  }
  return rawReq(uri, headers, method, body);
}

// ─── Nepal Time Helpers ──────────────────────────────────────────────────────

const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000;

function toNepalDate(utcDate) {
  return new Date(utcDate.getTime() + NPL_OFFSET_MS);
}

function getNepalMinutes(utcDate) {
  const npl = toNepalDate(utcDate);
  return npl.getUTCHours() * 60 + npl.getUTCMinutes();
}

function formatNplTime(utcDate) {
  const npl = toNepalDate(utcDate);
  const h = npl.getUTCHours();
  const m = String(npl.getUTCMinutes()).padStart(2, '0');
  const s = String(npl.getUTCSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m}:${s} ${ampm}`;
}

function formatNplDate(utcDate) {
  const npl = toNepalDate(utcDate);
  return `${npl.getUTCFullYear()}-${String(npl.getUTCMonth() + 1).padStart(2, '0')}-${String(npl.getUTCDate()).padStart(2, '0')}`;
}

// ─── Attendance Rules ─────────────────────────────────────────────────────────

function determineStatus(clockInMinutes) {
  if (clockInMinutes <= GRACE_DEADLINE) return 'present';
  return 'absent';
}

function calculateLateMinutes(clockInMinutes) {
  return Math.max(0, clockInMinutes - OFFICE_START);
}

function calculateOvertimeMinutes(clockOutMinutes) {
  if (clockOutMinutes <= OT_THRESHOLD) return 0;
  return clockOutMinutes - OT_THRESHOLD;
}

function calculateEarlyMinutes(clockOutMinutes) {
  if (clockOutMinutes >= OFFICE_END) return 0;
  return OFFICE_END - clockOutMinutes;
}

function calculateHours(clockIn, clockOut, breakMinutes = 0) {
  const totalMs = clockOut.getTime() - clockIn.getTime();
  const totalMinutes = totalMs / 60000;
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);
  return Math.round((workedMinutes / 60) * 100) / 100;
}

function isWeekend(dateUtc) {
  const day = dateUtc.getUTCDay();
  return day === 0 || day === 6;
}

// ─── Find device record ──────────────────────────────────────────────────────

async function getDeviceRecord() {
  // Try to find an active device for this workspace
  let device = await prisma.attendanceDevice.findFirst({
    where: { workspaceId: WORKSPACE_ID, isActive: true },
  });

  // If no device exists, create one
  if (!device) {
    device = await prisma.attendanceDevice.create({
      data: {
        workspaceId: WORKSPACE_ID,
        name: 'Hikvision DS-K1A8503EF-B',
        model: 'DS-K1A8503EF-B',
        ipAddress: DEVICE_IP,
        port: DEVICE_PORT,
        protocol: 'isapi',
        username: DEVICE_USER,
        password: DEVICE_PASS,
        isActive: true,
        status: 'online',
      },
    });
    console.log(`  Created device record: ${device.id}`);
  }

  return device;
}

// ─── Main sync logic ─────────────────────────────────────────────────────────

async function syncDevice() {
  const now = new Date();
  const startTime = new Date(now.getTime() - FETCH_DAYS * 24 * 60 * 60 * 1000);
  const fmtTime = d => d.toISOString().replace(/\.\d{3}Z$/, '');

  console.log(`[${now.toISOString()}] Syncing attendance from ${fmtTime(startTime)} to ${fmtTime(now)}`);

  const body = JSON.stringify({
    AcsEventCond: {
      searchID: `poll-${Date.now()}`,
      searchResultPosition: 0,
      maxResults: 150,
      major: 5,
      minor: 0,
      startTime: fmtTime(startTime),
      endTime: fmtTime(now),
    },
  });

  const r = await digestRequest('POST', '/ISAPI/AccessControl/AcsEvent?format=json', body);
  if (r.status !== 200) {
    throw new Error(`Device returned status ${r.status}: ${r.body.substring(0, 200)}`);
  }

  const data = JSON.parse(r.body);
  const events = data?.AcsEvent?.InfoList ?? [];
  const totalMatches = data?.AcsEvent?.totalMatches ?? 0;
  console.log(`  Found ${events.length} events (total matches: ${totalMatches})`);

  if (events.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const allEmployees = await prisma.employee.findMany({
    where: { workspaceId: WORKSPACE_ID, status: 'active' },
    select: { id: true, name: true, deviceEmployeeId: true },
  });

  const empMap = {};
  for (const emp of allEmployees) {
    if (emp.deviceEmployeeId) empMap[emp.deviceEmployeeId] = emp;
  }

  // Group by employee + Nepal date
  const grouped = {};
  for (const evt of events) {
    const empNo = evt.employeeNoString ?? evt.employeeNo ?? '';
    if (!empNo) {
      console.log(`  Skipping event with empty employee ID at time ${evt.time}`);
      continue;
    }
    const emp = empMap[empNo];
    if (!emp) {
      console.log(`  Skipping event for unmapped employee: ${empNo}`);
      continue;
    }
    const evtTime = new Date(evt.time);
    const nepalDateStr = formatNplDate(evtTime);
    const key = `${empNo}:${nepalDateStr}`;
    if (!grouped[key]) grouped[key] = { employee: emp, date: nepalDateStr, events: [] };
    grouped[key].events.push({ time: evtTime, raw: evt });
  }

  // Get the real device record for foreign key references
  const device = await getDeviceRecord();

  let created = 0, updated = 0, skipped = 0;

  for (const [key, group] of Object.entries(grouped)) {
    const { employee, date: nepalDateStr, events: groupEvents } = group;
    groupEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

    const clockIn = groupEvents[0].time;
    const clockOut = groupEvents.length > 1 ? groupEvents[groupEvents.length - 1].time : null;

    const [y, mo, d] = nepalDateStr.split('-').map(Number);
    const dateUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

    // Check for existing record
    const existing = await prisma.attendance.findFirst({
      where: { workspaceId: WORKSPACE_ID, employeeId: employee.id, date: dateUtc },
    });

    // Calculate all metrics
    const clockInMin = getNepalMinutes(clockIn);
    const status = determineStatus(clockInMin);
    const lateMinutes = calculateLateMinutes(clockInMin);

    let clockOutMin = 0;
    let overtimeMinutes = 0;
    let earlyMinutes = 0;
    let hours = 0;

    if (clockOut) {
      clockOutMin = getNepalMinutes(clockOut);
      overtimeMinutes = calculateOvertimeMinutes(clockOutMin);
      earlyMinutes = calculateEarlyMinutes(clockOutMin);
      hours = calculateHours(clockIn, clockOut, 0);
    }

    // Check if a break already exists for this attendance today
    const existingBreak = await prisma.break.findFirst({
      where: { workspaceId: WORKSPACE_ID, employeeId: employee.id, attendance: { date: dateUtc } },
    });
    const breakMinutes = existingBreak?.duration ?? 0;
    if (breakMinutes > 0) {
      hours = calculateHours(clockIn, clockOut || clockIn, breakMinutes);
    }

    if (existing) {
      // Update if missing clockOut or status needs correction
      if (clockOut && !existing.clockOut) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            clockIn,
            clockOut,
            status,
            hours,
            lateMinutes,
            earlyMinutes,
            overtime: overtimeMinutes,
          },
        });
        updated++;
        console.log(`  Updated ${employee.name} on ${nepalDateStr}: ${formatNplTime(clockIn)} → ${formatNplTime(clockOut)} = ${hours}h, status=${status}, OT=${overtimeMinutes}m`);
      } else {
        skipped++;
      }
    } else {
      await prisma.attendance.create({
        data: {
          workspaceId: WORKSPACE_ID,
          employeeId: employee.id,
          date: dateUtc,
          clockIn,
          clockOut,
          status,
          hours,
          overtime: overtimeMinutes,
          breakMinutes,
          lateMinutes,
          earlyMinutes,
          isHalfDay: false,
          isHoliday: false,
          isWeekend: isWeekend(dateUtc),
          source: 'device',
          deviceId: device.id,
        },
      });
      created++;
      console.log(`  Created ${employee.name} on ${nepalDateStr}: ${formatNplTime(clockIn)}${clockOut ? ' → ' + formatNplTime(clockOut) : ''} = ${hours}h, status=${status}, OT=${overtimeMinutes}m`);
    }
  }

  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId: device.id,
      type: 'sync',
      status: 'success',
      message: `Polled ${events.length} events, created: ${created}, updated: ${updated}, skipped: ${skipped}`,
      recordsSynced: created + updated,
      duration: null,
    },
  });

  // Update device last sync
  await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'success' },
  });

  return { created, updated, skipped };
}

// ─── Poller loop ─────────────────────────────────────────────────────────────

async function poll() {
  try {
    const result = await syncDevice();
    console.log(`  Result: created=${result.created} updated=${result.updated} skipped=${result.skipped}`);
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    try {
      const device = await getDeviceRecord();
      await prisma.attendanceDeviceLog.create({
        data: {
          deviceId: device.id,
          type: 'sync',
          status: 'failed',
          message: e.message,
          recordsSynced: 0,
        },
      });
      await prisma.attendanceDevice.update({
        where: { id: device.id },
        data: { lastSyncStatus: 'failed', errorMessage: e.message },
      });
    } catch (logErr) {
      console.error(`  Failed to log error: ${logErr.message}`);
    }
  }
}

async function main() {
  console.log('=== Hikvision Device Poller ===');
  console.log(`Device: ${DEVICE_IP}:${DEVICE_PORT}`);
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Rules: Office 9:30-17:30, Grace 9:40, OT after 17:35, Break max 35min x1`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);
  console.log(`Lookback: ${FETCH_DAYS} days`);
  console.log('');

  await poll();

  console.log(`\nNext sync in ${POLL_INTERVAL_MS / 60000} minutes...`);
  setInterval(async () => {
    await poll();
    console.log(`\nNext sync in ${POLL_INTERVAL_MS / 60000} minutes...`);
  }, POLL_INTERVAL_MS);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
