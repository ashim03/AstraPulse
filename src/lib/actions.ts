import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export type AuditInput = {
  session: SessionUser | null;
  action: string;
  module: string;
  recordId?: string;
  description: string;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: input.session?.workspaceId ?? "system",
        userId: input.session?.id ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId,
        description: input.description,
        before: input.before ? JSON.stringify(input.before) : null,
        after: input.after ? JSON.stringify(input.after) : null,
      },
    });
  } catch {
    // audit should never break the primary flow
  }
}

export async function notify(workspaceId: string, userId: string, title: string, body?: string, link?: string) {
  try {
    await prisma.notification.create({
      data: { workspaceId, userId, title, body, link },
    });
  } catch {
    // ignore
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T = undefined>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors };
}