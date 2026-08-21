import { prisma } from "@/lib/prisma";

export type HikvisionAttendanceRecord = {
  employeeId: string;
  date: string; // yyyy-MM-dd
  clockIn: string; // HH:mm:ss or null
  clockOut: string; // HH:mm:ss or null
  status: "present" | "absent" | "late" | "early" | "remote";
};

export async function fetchHikvisionAttendance(
  ip: string,
  port: number = 80,
  username: string = "admin",
  password: string = "",
  beginDate?: Date,
  endDate?: Date
): Promise<HikvisionAttendanceRecord[]> {
  const start = beginDate || new Date();
  const end = endDate || new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const beginStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const url = `http://${ip}:${port}/ISAPI/Attendance/Record?beginTime=${beginStr}&endTime=${endStr}&status=0&pagenumber=1&pagesize=1000`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization:
      "Basic " + btoa(`${username}:${password}`),
      "Content-Type": "application/xml",
    },
    // timeout: 30000,
  });

  if (!res.ok) {
    throw new Error(`Hikvision API error: ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();
  return parseHikvisionXml(xmlText);
}

function parseHikvisionXml(xml: string): HikvisionAttendanceRecord[] {
  const records: HikvisionAttendanceRecord[] = [];

  // Hikvision ISAPI XML response structure:
  // <AttendanceRecord>
  //   <employeeId>...</employeeId>
  //   <date>...</date>
  //   <time>...</time>
  //   <status>...</status>
  // </AttendanceRecord>

  // Simple XML parsing - extract employeeId, date, time, status
  const employeeIdMatches = xml.match(/<employeeId>([^<]+)<\/employeeId>/g) || [];
  const dateMatches = xml.match(/<date>([^<]+)<\/date>/g) || [];
  const timeMatches = xml.match(/<time>([^<]+)<\/time>/g) || [];
  const statusMatches = xml.match(/<status>([^<]+)<\/status>/g) || [];

  const count = Math.min(
    employeeIdMatches.length,
    dateMatches.length,
    timeMatches.length,
    statusMatches.length
  );

  for (let i = 0; i < count; i++) {
    const employeeId = extractTagContent(employeeIdMatches[i]);
    const date = extractTagContent(dateMatches[i]);
    const time = extractTagContent(timeMatches[i]);
    const status = extractTagContent(statusMatches[i]);

    if (!employeeId || !date) continue;

    let clockIn: string | null = null;
    let clockOut: string | null = null;
    let statusText: HikvisionAttendanceRecord["status"] = "present";

    // Parse time - could be clock-in or clock-out depending on Hikvision model
    if (time) {
      // Normalize time format
      const timeMatch = time.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch) {
        clockIn = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
      }
    }

    // Determine status based on Hikvision status field
    if (status) {
      statusText = status.toLowerCase() as any;
    }

    records.push({
      employeeId,
      date,
      clockIn: clockIn ?? "",
      clockOut: clockOut ?? "",
      status: statusText,
    });
  }

  return records;
}

function extractTagContent(tag: string): string {
  const match = tag.match(/<([^>]+)>([^<]+)<\/\1>/);
  return match ? match[2].trim() : "";
}

export async function syncHikvisionAttendanceToDatabase(
  ip: string,
  port: number = 80,
  username: string = "admin",
  password: string = "",
  beginDate?: Date,
  endDate?: Date
): Promise<{
  imported: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  try {
    const records = await fetchHikvisionAttendance(ip, port, username, password, beginDate, endDate);

    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    for (const record of records) {
      try {
        const existing = await prisma.attendance.findFirst({
          where: {
            workspaceId: "", // Will be set per workspace - this is a simplified sync
            employeeId: record.employeeId,
            date: new Date(record.date),
          },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const recordDate = new Date(record.date);

        if (existing) {
          // Update existing record
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              clockIn: record.clockIn ? new Date(`${record.date}T${record.clockIn}`) : existing.clockIn,
              clockOut: record.clockOut ? new Date(`${record.date}T${record.clockOut}`) : existing.clockOut,
              status: record.status,
            },
          });
          updated++;
        } else {
          // Create new record
          await prisma.attendance.create({
            data: {
              workspaceId: "", // Needs workspace context
              employeeId: record.employeeId,
              date: recordDate,
              clockIn: record.clockIn ? new Date(`${record.date}T${record.clockIn}`) : undefined,
              clockOut: record.clockOut ? new Date(`${record.date}T${record.clockOut}`) : undefined,
              status: record.status,
            },
          });
          created++;
        }
      } catch (e) {
        errors.push(`Error processing employee ${record.employeeId}: ${(e as Error).message}`);
      }
    }

    return { imported: records.length, created, updated, errors };
  } catch (e) {
    return { imported: 0, created: 0, updated: 0, errors: [(e as Error).message] };
  }
}