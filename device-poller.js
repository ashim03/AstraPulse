/**
 * Hikvision Device Poller — run locally to sync attendance from the device.
 * 
 * Usage:
 *   node device-poller.js
 * 
 * This script polls the Hikvision device every N minutes,
 * fetches new attendance events, and stores them in the database.
 * 
 * Requirements:
 *   - Device must be on the same local network
 *   - DATABASE_URL env var must be set (or .env loaded)
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
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const FETCH_DAYS = 7; // Look back 7 days for events

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

// ─── Attendance mapping ──────────────────────────────────────────────────────

function mapAttendanceStatus(evt) {
  if (evt.attendanceStatus && evt.attendanceStatus !== 'undefined') return evt.attendanceStatus;
  const minor = evt.minor;
  if (minor !== undefined) {
    switch (Number(minor)) {
      case 38: return 'checkIn';
      case 49: return 'checkIn';
      case 75: return 'checkIn';
    }
  }
  const timeStr = evt.time ?? '';
  if (timeStr) {
    const hour = parseInt(timeStr.split('T')[1]?.split(':')[0] ?? '12', 10);
    if (hour < 10) return 'checkIn';
    if (hour >= 17) return 'checkOut';
    if (hour >= 12 && hour < 14) return 'breakOut';
    return 'checkIn';
  }
  return 'checkIn';
}

// ─── Main sync logic ─────────────────────────────────────────────────────────

async function syncDevice() {
  const startTime = new Date(Date.now() - FETCH_DAYS * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  const fmtTime = d => d.toISOString().replace(/\.\d{3}Z$/, '');

  console.log(`[${new Date().toISOString()}] Syncing attendance from ${fmtTime(startTime)} to ${fmtTime(endTime)}`);

  // Fetch events from device
  const body = JSON.stringify({
    AcsEventCond: {
      searchID: `poll-${Date.now()}`,
      searchResultPosition: 0,
      maxResults: 150,
      major: 5,
      minor: 0,
      startTime: fmtTime(startTime),
      endTime: fmtTime(endTime),
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

  // Find employee mapping
  const employees = await prisma.employee.findMany({
    where: { workspaceId: WORKSPACE_ID, deviceEmployeeId: { not: null } },
    select: { id: true, name: true, deviceEmployeeId: true },
  });

  const empMap = {};
  for (const emp of employees) {
    empMap[emp.deviceEmployeeId] = emp;
  }

  let created = 0, updated = 0, skipped = 0;

  for (const evt of events) {
    const empNo = evt.employeeNoString ?? '';
    const emp = empMap[empNo];
    if (!emp) {
      console.log(`  Skipping event for unmapped employee: ${empNo}`);
      skipped++;
      continue;
    }

    const timeStr = evt.time;
    if (!timeStr) { skipped++; continue; }

    const eventTime = new Date(timeStr);
    const eventDate = new Date(eventTime);
    eventDate.setUTCHours(0, 0, 0, 0);

    const status = mapAttendanceStatus(evt);

    const existing = await prisma.attendance.findFirst({
      where: { workspaceId: WORKSPACE_ID, employeeId: emp.id, date: eventDate },
    });

    if (existing) {
      if (status === 'checkOut' && !existing.clockOut) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { clockOut: eventTime },
        });
        updated++;
        console.log(`  Updated clockOut for ${emp.name} on ${eventDate.toISOString().split('T')[0]}`);
      }
    } else {
      await prisma.attendance.create({
        data: {
          workspaceId: WORKSPACE_ID,
          employeeId: emp.id,
          date: eventDate,
          clockIn: eventTime,
          clockOut: null,
          status: 'present',
          source: 'device',
          deviceId: DEVICE_ID,
          hours: 0,
          overtime: 0,
          breakMinutes: 0,
          lateMinutes: 0,
          earlyMinutes: 0,
          isHalfDay: false,
          isHoliday: false,
          isWeekend: false,
        },
      });
      created++;
      console.log(`  Created attendance for ${emp.name} on ${eventDate.toISOString().split('T')[0]}`);
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

  // Initial sync
  await poll();

  // Schedule periodic sync
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
