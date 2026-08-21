import type { SessionUser } from "@/lib/auth";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export" | "manage";

const OWNER_ROLES = ["Super Admin", "Workspace Admin"];

export function parsePermissions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasPermission(
  user: SessionUser | { role: string | null; rolePermissions?: string[] } | null,
  module: string,
  action: PermissionAction = "view"
): boolean {
  if (!user) return false;
  const roleName = user.role ?? "";
  if (OWNER_ROLES.includes(roleName)) return true;

  const perms =
    "rolePermissions" in user && user.rolePermissions
      ? user.rolePermissions
      : roleName
        ? defaultRolePermissions(roleName)
        : [];
  return (
    perms.includes("*") ||
    perms.includes(`${module}:*`) ||
    perms.includes(`${module}:${action}`) ||
    perms.includes(module)
  );
}

export function defaultRolePermissions(roleName: string): string[] {
  const map: Record<string, string[]> = {
    "HR Manager": [
      "staff",
      "departments",
      "attendance",
      "leave",
      "holidays",
      "tasks",
      "work-records",
      "advances",
      "documents",
      "announcements",
      "analytics",
      "reports",
      "mail",
    ],
    Accountant: [
      "accounting",
      "expenses",
      "income",
      "invoices",
      "payments",
      "reports",
      "banks",
      "analytics",
      "mail",
      "customers",
      "vendors",
    ],
    "Payroll Manager": ["payroll", "advances", "reports", "analytics", "mail"],
    Manager: ["tasks", "work-records", "leave", "attendance", "reports", "mail", "announcements"],
    Employee: ["attendance", "leave", "work-records", "tasks", "mail"],
  };
  return map[roleName] ?? [];
}

export function requirePermission(user: SessionUser, module: string, action: PermissionAction = "view") {
  return hasPermission(user, module, action);
}