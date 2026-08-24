"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, ok, fail, type ActionResult } from "@/lib/actions";

// ─── Attendance Correction ────────────────────────────────────────────────────

export type CorrectionType = "missing_checkin" | "missing_checkout" | "incorrect_status" | "device_failed" | "other";

export async function submitAttendanceCorrection(data: {
  attendanceId?: string;
  date: string;
  type: CorrectionType;
  reason: string;
  clockIn?: string;
  clockOut?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
      include: { employee: true },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked to your account");

    if (!data.date || !data.type || !data.reason) {
      return fail("Date, type, and reason are required");
    }

    const adjustment = await prisma.attendanceAdjustment.create({
      data: {
        workspaceId: session.workspaceId,
        employeeId,
        date: new Date(data.date),
        type: data.type,
        reason: data.reason,
        status: "pending",
      },
    });

    await writeAudit({
      session,
      action: "create",
      module: "attendance",
      recordId: adjustment.id,
      description: `Submitted attendance correction for ${data.date}: ${data.type}`,
    });

    revalidatePath("/employee/requests");
    return ok(undefined, "Correction request submitted successfully");
  } catch (e) {
    return fail("Failed to submit correction: " + (e as Error).message);
  }
}

export async function getMyCorrections(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked");

    const corrections = await prisma.attendanceAdjustment.findMany({
      where: { workspaceId: session.workspaceId, employeeId },
      orderBy: { date: "desc" },
    });

    return ok(corrections);
  } catch (e) {
    return fail("Failed to load corrections: " + (e as Error).message);
  }
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function submitLeaveRequest(data: {
  typeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  isHalfDay?: boolean;
}): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked to your account");

    if (!data.typeId || !data.startDate || !data.endDate) {
      return fail("Leave type, start date, and end date are required");
    }

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: data.typeId, workspaceId: session.workspaceId },
    });
    if (!leaveType) return fail("Invalid leave type");

    const days = data.isHalfDay ? 0.5 : data.days;
    if (days <= 0) return fail("Number of days must be greater than 0");

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        workspaceId: session.workspaceId,
        employeeId,
        typeId: data.typeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days,
        reason: data.reason || null,
        status: "pending",
      },
    });

    await writeAudit({
      session,
      action: "create",
      module: "leave",
      recordId: leaveRequest.id,
      description: `Submitted ${leaveType.name} leave request: ${days} day(s) from ${data.startDate}`,
    });

    revalidatePath("/employee/requests");
    return ok(undefined, "Leave request submitted successfully");
  } catch (e) {
    return fail("Failed to submit leave request: " + (e as Error).message);
  }
}

export async function getMyLeaveRequests(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked");

    const requests = await prisma.leaveRequest.findMany({
      where: { workspaceId: session.workspaceId, employeeId },
      include: { type: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(requests);
  } catch (e) {
    return fail("Failed to load leave requests: " + (e as Error).message);
  }
}

export async function cancelLeaveRequest(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked");

    const request = await prisma.leaveRequest.findFirst({
      where: { id, workspaceId: session.workspaceId, employeeId },
    });
    if (!request) return fail("Leave request not found");
    if (request.status !== "pending") return fail("Only pending requests can be cancelled");

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "cancelled" },
    });

    await writeAudit({
      session,
      action: "edit",
      module: "leave",
      recordId: id,
      description: `Cancelled leave request`,
    });

    revalidatePath("/employee/requests");
    return ok(undefined, "Leave request cancelled");
  } catch (e) {
    return fail("Failed to cancel leave request: " + (e as Error).message);
  }
}

export async function getLeaveBalance(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const user = await prisma.user.findFirst({
      where: { id: session.id, workspaceId: session.workspaceId },
    });
    const employeeId = user?.employeeId;
    if (!employeeId) return fail("No employee profile linked");

    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const [types, approvedLeaves] = await Promise.all([
      prisma.leaveType.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { name: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          workspaceId: session.workspaceId,
          employeeId,
          status: "approved",
          startDate: { gte: yearStart, lte: yearEnd },
        },
        include: { type: true },
      }),
    ]);

    const balance = types.map((t) => {
      const used = approvedLeaves
        .filter((l) => l.typeId === t.id)
        .reduce((sum, l) => sum + l.days, 0);
      return {
        typeId: t.id,
        typeName: t.name,
        color: t.color,
        daysPerYear: t.daysPerYear,
        used,
        remaining: Math.max(0, t.daysPerYear - used),
      };
    });

    return ok(balance);
  } catch (e) {
    return fail("Failed to load leave balance: " + (e as Error).message);
  }
}
