import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { canAccessEmployee, canModifyEmployee, getDataScope, getSafeEmployeeSelect } from "@/lib/permissions";

export async function getAccessibleEmployees(
  user: SessionUser,
  options?: {
    include?: Record<string, boolean | object>;
    where?: Record<string, any>;
    orderBy?: any;
    take?: number;
  }
) {
  const scope = getDataScope(user);

  if (scope === "all") {
    return prisma.employee.findMany({
      where: { workspaceId: user.workspaceId, ...options?.where },
      include: options?.include,
      orderBy: options?.orderBy,
      take: options?.take,
    });
  }

  if (scope === "department" && user.departmentId) {
    return prisma.employee.findMany({
      where: {
        workspaceId: user.workspaceId,
        departmentId: user.departmentId,
        ...options?.where,
      },
      include: options?.include,
      orderBy: options?.orderBy,
      take: options?.take,
    });
  }

  return prisma.employee.findMany({
    where: {
      workspaceId: user.workspaceId,
      id: user.employeeId ?? "__none__",
      ...options?.where,
    },
    include: options?.include,
    orderBy: options?.orderBy,
    take: options?.take,
  });
}

export async function getEmployee(
  user: SessionUser,
  employeeId: string,
  options?: { include?: Record<string, boolean | object> }
) {
  if (!canAccessEmployee(user, employeeId)) {
    throw new Error("ACCESS_DENIED");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: options?.include,
  });

  if (!employee || employee.workspaceId !== user.workspaceId) {
    throw new Error("NOT_FOUND");
  }

  return employee;
}

export function getEmployeeSelect(user: SessionUser) {
  return getSafeEmployeeSelect(user);
}
