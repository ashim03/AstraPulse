import { prisma } from "@/lib/prisma";

type AuthAuditParams = {
  workspaceId: string;
  userId?: string;
  email: string;
  action: string;
  success: boolean;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
};

export async function logAuthEvent(params: AuthAuditParams): Promise<void> {
  try {
    await prisma.authAuditLog.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId ?? null,
        email: params.email,
        action: params.action,
        success: params.success,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch {
    // audit logging should never break the primary flow
  }
}

export async function getAuthAuditLogs(
  workspaceId: string,
  options: {
    page?: number;
    limit?: number;
    action?: string;
    email?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  logs: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, any> = { workspaceId };

  if (options.action) {
    where.action = options.action;
  }
  if (options.email) {
    where.email = { contains: options.email, mode: "insensitive" };
  }
  if (options.userId) {
    where.userId = options.userId;
  }
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.authAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.authAuditLog.count({ where }),
  ]);

  const parsedLogs = logs.map((log) => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));

  return {
    logs: parsedLogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
