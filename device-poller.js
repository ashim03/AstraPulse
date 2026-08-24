/**
 * Hikvision Device Poller — run locally to sync attendance from the device.
 *
 * Usage:   node device-poller.js
 *          pm2 start ecosystem.config.js
 *
 * Timezone: Nepal (UTC+5:45). All times stored in UTC in DB.
 *           The device sends UTC timestamps (Z suffix).
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const http = require('http');

// ─── Config ──────────────────────────────────────────────────────────────────

const DEVICE_IP = '192.168.1.69';
const DEVICE_PORT = 80;
const DEVICE_USER = 'admin';
const DEVICE_PASS = 'Aicnepal@0012!';
const WORKSPACE_ID = 'cmt5sjd04000062bm41d445cb';
const DEVICE_ID = 'hikvision-main';
const POLL_INTERVAL_MS = 15 * 60 * 1000;
const FETCH_DAYS = 7;

// Office hours in Nepal time (for late/early calculations)
const OFFICE_START_HOUR = 10;
const OFFICE_START_MIN = 0;
const OFFICE_END_HOUR = 18;
const OFFICE_END_MIN = 0;
const GRACE_MINUTES = 15;

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

const NPL_OFFSET_MS = 5.75 * 60 * 60 * 1000; // +5:45 in ms

function toNepalDate(utcDate) {
  return new Date(utcDate.getTime() + NPL_OFFSET_MS);
}

function getNepalHours(utcDate) {
  const npl = toNepalDate(utcDate);
  return npl.getUTCHours();
}

function getNepalMinutes(utcDate) {
  const npl = toNepalDate(utcDate);
  return npl.getUTCMinutes();
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

function startOfDayNpl(utcDate) {
  const npl = toNepalDate(utcDate);
  npl.setHours(0, 0, 0, 0);
  return new Date(npl.getTime() - NPL_OFFSET_MS);
}

// ─── Main sync logic ─────────────────────────────────────────────────────────

async function syncDevice() {
  const now = new Date();
  const startTime = new Date(now.getTime() - FETCH_DAYS * 24 * 60 * 60 * 1000);
  const fmtTime = d => d.toISOString().replace(/\.\d{3}Z$/, '');

  console.log(`[${now.toISOString()}] Syncing attendance from ${fmtTime(startTime)} to ${fmtTime(now)}`);

  // Fetch all events from device
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

  // Find ALL employees (including unmapped) for reference
  const allEmployees = await prisma.employee.findMany({
    where: { workspaceId: WORKSPACE_ID, status: 'active' },
    select: { id: true, name: true, deviceEmployeeId: true },
  });

  const empMap = {};
  for (const emp of allEmployees) {
    if (emp.deviceEmployeeId) {
      empMap[emp.deviceEmployeeId] = emp;
    }
  }

  // Group events by employee + date (using Nepal date)
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

    if (!grouped[key]) {
      grouped[key] = { employee: emp, date: nepalDateStr, events: [] };
    }
    grouped[key].events.push({ time: evtTime, raw: evt });
  }

  let created = 0, updated = 0, skipped = 0;

  for (const [key, group] of Object.entries(grouped)) {
    const { employee, date: nepalDateStr, events: groupEvents } = group;

    // Sort events by time ascending
    groupEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

    const clockIn = groupEvents[0].time;
    const clockOut = groupEvents.length > 1 ? groupEvents[groupEvents.length - 1].time : null;

    // Calculate date as start of Nepal day in UTC
    const [y, mo, d] = nepalDateStr.split('-').map(Number);
    const dateUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));

    // Check if attendance record already exists
    const existing = await prisma.attendance.findFirst({
      where: { workspaceId: WORKSPACE_ID, employeeId: employee.id, date: dateUtc },
    });

    if (existing) {
      // Update clockOut if missing
      if (clockOut && !existing.clockOut) {
        const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100;
        const lateMinutes = calculateLateMinutes(clockIn);
        const earlyMinutes = calculateEarlyMinutes(clockOut);
        const overtime = calculateOvertime(hours);

        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            clockIn,
            clockOut,
            hours,
            lateMinutes,
            earlyMinutes,
            overtime,
            status: getStatus(lateMinutes),
          },
        });
        updated++;
        console.log(`  Updated clockOut for ${employee.name} on ${nepalDateStr} — ${formatNplTime(clockIn)} to ${formatNplTime(clockOut)} = ${hours}h`);
      } else {
        skipped++;
        console.log(`  Already exists for ${employee.name} on ${nepalDateStr} (clockOut: ${existing.clockOut ? 'set' : 'null'})`);
      }
    } else {
      // Create new attendance
      const hours = clockOut ? Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100 : 0;
      const lateMinutes = calculateLateMinutes(clockIn);
      const earlyMinutes = clockOut ? calculateEarlyMinutes(clockOut) : 0;
      const overtime = calculateOvertime(hours);

      await prisma.attendance.create({
        data: {
          workspaceId: WORKSPACE_ID,
          employeeId: employee.id,
          date: dateUtc,
          clockIn,
          clockOut,
          hours,
          overtime,
          breakMinutes: 0,
          lateMinutes,
          earlyMinutes,
          isHalfDay: false,
          isHoliday: false,
          isWeekend: isWeekend(dateUtc),
          status: getStatus(lateMinutes),
          source: 'device',
          deviceId: DEVICE_ID,
        },
      });
      created++;
      console.log(`  Created attendance for ${employee.name} on ${nepalDateStr} — ${formatNplTime(clockIn)}${clockOut ? ' to ' + formatNplTime(clockOut) : ' (no checkout)'} = ${hours}h, late: ${lateMinutes}m`);
    }
  }

  // Log sync
  await prisma.attendanceDeviceLog.create({
    data: {
      deviceId: DEVICE_ID,
      type: 'sync',
      status: 'success',
      message: `Polled ${events.length} events, created: ${created}, updated: ${updated}, skipped: ${skipped}`,
      recordsSynced: created + updated,
      duration: null,
    },
  });

  return { created, updated, skipped };
}

// ─── Attendance calculations (all in Nepal time) ─────────────────────────────

function calculateLateMinutes(clockInUtc) {
  const nplH = getNepalHours(clockInUtc);
  const nplM = getNepalMinutes(clockInUtc);
  const clockInMinutes = nplH * 60 + nplM;
  const officeStartMinutes = OFFICE_START_HOUR * 60 + OFFICE_START_MIN;
  const graceDeadline = officeStartMinutes + GRACE_MINUTES;

  if (clockInMinutes <= graceDeadline) return 0;
  return clockInMinutes - officeStartMinutes;
}

function calculateEarlyMinutes(clockOutUtc) {
  const nplH = getNepalHours(clockOutUtc);
  const nplM = getNepalMinutes(clockOutUtc);
  const clockOutMinutes = nplH * 60 + nplM;
  const officeEndMinutes = OFFICE_END_HOUR * 60 + OFFICE_END_MIN;

  if (clockOutMinutes >= officeEndMinutes) return 0;
  return officeEndMinutes - clockOutMinutes;
}

function calculateOvertime(hours) {
  const standardHours = OFFICE_END_HOUR - OFFICE_START_HOUR;
  if (hours <= standardHours) return 0;
  return Math.round((hours - standardHours) * 100) / 100;
}

function getStatus(lateMinutes) {
  if (lateMinutes > 240) return 'absent';
  if (lateMinutes > 60) return 'half_day';
  if (lateMinutes > 0) return 'late';
  return 'present';
}

function isWeekend(dateUtc) {
  const day = dateUtc.getUTCDay();
  return day === 0 || day === 6;
}

// ─── Poller loop ─────────────────────────────────────────────────────────────

async function poll() {
  try {
    const result = await syncDevice();
    console.log(`  Result: created=${result.created} updated=${result.updated} skipped=${result.skipped}`);
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    try {
      await prisma.attendanceDeviceLog.create({
        data: {
          deviceId: DEVICE_ID,
          type: 'sync',
          status: 'failed',
          message: e.message,
          recordsSynced: 0,
        },
      });
    } catch {}
  }
}

async function main() {
  console.log('=== Hikvision Device Poller ===');
  console.log(`Device: ${DEVICE_IP}:${DEVICE_PORT}`);
  console.log(`Workspace: ${WORKSPACE_ID}`);
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
