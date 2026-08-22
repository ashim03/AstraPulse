import type { SessionUser } from "@/lib/auth";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export" | "manage";

export function hasPermission(
  user: SessionUser | null,
  module: string,
  action: PermissionAction = "view"
): boolean {
  if (!user) return false;
  
  // Super Admin has all permissions
  if (user.accountType === "super_admin") return true;
  
  // Workspace Admin gets all org permissions
  if (user.role === "Workspace Admin") return true;
  
  // Check role permissions
  const perms = user.rolePermissions ?? [];
  
  return (
    perms.includes("*") ||
    perms.includes(`${module}:*`) ||
    perms.includes(`${module}:${action}`) ||
    perms.includes(module)
  );
}

export function requirePermission(
  user: SessionUser | null,
  module: string,
  action: PermissionAction = "view"
): boolean {
  return hasPermission(user, module, action);
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.accountType === "super_admin";
}

export function isOrganizationAdmin(user: SessionUser | null): boolean {
  return user?.role === "Workspace Admin" && user?.accountType === "organization";
}

export function parsePermissions(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Module-to-permission mapping for sidebar filtering
export const MODULE_PERMISSIONS: Record<string, string> = {
  "/": "dashboard",
  "/analytics": "analytics",
  "/staff": "staff",
  "/departments": "departments",
  "/attendance": "attendance",
  "/leave": "leave",
  "/holidays": "holidays",
  "/tasks": "tasks",
  "/work-records": "work-records",
  "/advances": "advances",
  "/payroll": "payroll",
  "/expenses": "expenses",
  "/income": "income",
  "/accounting": "accounting",
  "/invoices": "invoices",
  "/payments": "payments",
  "/reports": "reports",
  "/announcements": "announcements",
  "/mail": "mail",
  "/audit-logs": "audit-logs",
  "/settings": "settings",
  "/subscription": "subscription",
  "/documents": "documents",
};

// Super admin routes
export const SUPER_ADMIN_ROUTES = ["/super-admin"];

// Routes that require organization admin or higher
export const ADMIN_ONLY_ROUTES = ["/settings", "/subscription", "/audit-logs"];
