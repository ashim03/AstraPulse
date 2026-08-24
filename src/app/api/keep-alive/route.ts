import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

let isRunning = false;
let lastExecution: string | null = null;

export async function GET() {
  if (isRunning) {
    return NextResponse.json({ ok: true, skipped: true, reason: "previous execution still running" });
  }

  isRunning = true;
  const start = Date.now();

  try {
    // Lightweight task: verify DB connectivity + count active resources
    const [workspaceCount, employeeCount, pendingLeaves] = await Promise.all([
      prisma.workspace.count({ where: { status: "active" } }),
      prisma.employee.count({ where: { status: "active" } }),
      prisma.leaveRequest.count({ where: { status: "pending" } }),
    ]);

    const duration = Date.now() - start;
    lastExecution = new Date().toISOString();

    return NextResponse.json({
      ok: true,
      executedAt: lastExecution,
      duration: `${duration}ms`,
      metrics: { workspaceCount, employeeCount, pendingLeaves },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: msg, duration: `${Date.now() - start}ms` }, { status: 500 });
  } finally {
    isRunning = false;
  }
}
