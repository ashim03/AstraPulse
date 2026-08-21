"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";
import { startOfDay } from "date-fns";

export async function clockInAction(): Promise<ActionResult> {
  const session = await requireSession();
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = startOfDay(new Date());
  const existing = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (existing?.clockIn) return fail("You already clocked in today");

  const now = new Date();
  await prisma.attendance.create({
    data: {
      workspaceId: session.workspaceId,
      employeeId,
      date: today,
      clockIn: now,
      status: "present",
    },
  });
  await writeAudit({ session, action: "create", module: "attendance", description: `Clocked in at ${now.toLocaleTimeString()}` });
  revalidatePath("/attendance");
  return ok(undefined, "Clocked in");
}

export async function clockOutAction(): Promise<ActionResult> {
  const session = await requireSession();
  const user = await prisma.user.findFirst({
    where: { id: session.id, workspaceId: session.workspaceId },
    include: { employee: true },
  });
  const employeeId = user?.employeeId;
  if (!employeeId) return fail("No employee profile linked to your account");

  const today = startOfDay(new Date());
  const record = await prisma.attendance.findFirst({
    where: { workspaceId: session.workspaceId, employeeId, date: today },
  });
  if (!record) return fail("You have not clocked in today");
  if (record.clockOut) return fail("You already clocked out today");

  const clockOut = new Date();
  const hours = Math.max(0.1, (clockOut.getTime() - (record.clockIn ?? clockOut).getTime()) / 3600000);
  await prisma.attendance.update({
    where: { id: record.id },
    data: { clockOut, hours: Math.round(hours * 10) / 10, status: "present" },
  });
  await writeAudit({ session, action: "edit", module: "attendance", description: `Clocked out after ${hours.toFixed(1)}h` });
  revalidatePath("/attendance");
  return ok(undefined, "Clocked out");
}

export async function attendanceAdjustAction(
  id: string,
  data: { hours: number; status: string; note?: string }
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const record = await prisma.attendance.findFirst({ where: { id, workspaceId: session.workspaceId } });
    if (!record) return fail("Record not found");
    await prisma.attendance.update({
      where: { id },
      data: { hours: data.hours, status: data.status as never, note: data.note || null },
    });
    await writeAudit({ session, action: "edit", module: "attendance", recordId: id, description: `Adjusted attendance record` });
    revalidatePath("/attendance");
    return ok(undefined, "Record updated");
  } catch (e) {
    return fail("Failed to update attendance record. Please try again.");
  }
}