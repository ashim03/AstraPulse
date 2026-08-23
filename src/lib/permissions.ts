import type { SessionUser } from "@/lib/auth";

export type PermissionAction =
  | "view" | "create" | "edit" | "delete" | "approve" | "export" | "manage"
  | "view_sensitive" | "reports" | "settings" | "device" | "employee_dashboard"
  | "preview" | "periods" | "auth" | "assign";

// ─── Granular Permission Definitions ────────────────────────────────────────
// Format: "module" or "module:action"
// Wildcards: "*" = all permissions, "module:*" = all actions on module

export const ALL_PERMISSIONS = [
  // Dashboard
  "dashboard:view",
  "analytics:view",

  // Staff / Employee Management
  "staff:view",
  "staff:create",
  "staff:edit",
  "staff:delete",
  "staff:view_sensitive",

  // Departments
  "departments:view",
  "departments:create",
  "departments:edit",
  "departments:delete",

  // Attendance
  "attendance:view",
  "attendance:create",
  "attendance:edit",
  "attendance:manage",
  "attendance:settings",
  "attendance:device",
  "attendance:reports",
  "attendance:employee_dashboard",

  // Leave
  "leave:view",
  "leave:create",
  "leave:approve",
  "leave:manage",

  // Holidays
  "holidays:view",
  "holidays:create",
  "holidays:edit",
  "holidays:delete",

  // Tasks
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "tasks:delete",
  "tasks:assign",

  // Work Records
  "work-records:view",
  "work-records:create",
  "work-records:approve",
  "work-records:delete",

  // Employee Advances
  "advances:view",
  "advances:create",
  "advances:approve",
  "advances:delete",

  // Payroll
  "payroll:view",
  "payroll:create",
  "payroll:approve",
  "payroll:manage",
  "payroll:preview",
  "payroll:periods",

  // Finance
  "expenses:view",
  "expenses:create",
  "expenses:edit",
  "expenses:approve",
  "income:view",
  "income:create",
  "income:edit",
  "accounting:view",
  "accounting:create",
  "accounting:edit",
  "invoices:view",
  "invoices:create",
  "invoices:edit",
  "invoices:approve",
  "payments:view",
  "payments:create",
  "payments:edit",

  // Reports
  "reports:view",
  "reports:export",

  // Announcements
  "announcements:view",
  "announcements:create",
  "announcements:edit",
  "announcements:delete",

  // Internal Mail
  "mail:view",
  "mail:create",
  "mail:delete",

  // Audit Logs
  "audit-logs:view",
  "audit-logs:export",

  // Settings
  "settings:view",
  "settings:edit",
  "settings:auth",
  "settings:email",

  // Subscription
  "subscription:view",
  "subscription:manage",

  // Users & Roles
  "users:view",
  "users:create",
  "users:edit",
  "users:delete",
  "roles:view",
  "roles:create",
  "roles:edit",
  "roles:delete",
  "roles:assign",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number] | "*";

// ─── Role Default Permissions ───────────────────────────────────────────────

export const ROLE_DEFAULTS: Record<string, string[]> = {
  "Workspace Admin": [
    "dashboard:view", "analytics:view",
    "staff:*", "departments:*",
    "attendance:*", "leave:*", "holidays:*",
    "tasks:*", "work-records:*", "advances:*",
    "payroll:*",
    "expenses:*", "income:*", "accounting:*", "invoices:*", "payments:*",
    "reports:*",
    "announcements:*", "mail:*",
    "audit-logs:*",
    "settings:*",
    "subscription:*",
    "users:*", "roles:*",
  ],
  "HR Manager": [
    "dashboard:view", "analytics:view",
    "staff:view", "staff:create", "staff:edit", "staff:view_sensitive",
    "departments:view",
    "attendance:view", "attendance:edit", "attendance:manage", "attendance:reports", "attendance:employee_dashboard",
    "leave:view", "leave:create", "leave:approve",
    "holidays:view", "holidays:create",
    "tasks:view", "tasks:create", "tasks:assign",
    "work-records:view", "work-records:approve",
    "advances:view",
    "payroll:view",
    "reports:view", "reports:export",
    "announcements:view", "announcements:create",
    "mail:view", "mail:create",
  ],
  "HR Staff": [
    "dashboard:view",
    "staff:view", "staff:create",
    "departments:view",
    "attendance:view", "attendance:edit", "attendance:reports",
    "leave:view", "leave:create",
    "holidays:view",
    "tasks:view",
    "work-records:view",
    "announcements:view",
    "mail:view", "mail:create",
  ],
  "Finance Manager": [
    "dashboard:view", "analytics:view",
    "staff:view",
    "attendance:view",
    "payroll:view", "payroll:create", "payroll:approve", "payroll:manage", "payroll:preview", "payroll:periods",
    "expenses:view", "expenses:create", "expenses:edit", "expenses:approve",
    "income:view", "income:create", "income:edit",
    "accounting:view", "accounting:create", "accounting:edit",
    "invoices:view", "invoices:create", "invoices:edit", "invoices:approve",
    "payments:view", "payments:create", "payments:edit",
    "reports:view", "reports:export",
    "advances:view", "advances:approve",
  ],
  "Payroll Staff": [
    "dashboard:view",
    "staff:view",
    "attendance:view",
    "payroll:view", "payroll:create", "payroll:preview",
    "expenses:view",
    "reports:view",
  ],
  "Manager": [
    "dashboard:view",
    "staff:view",
    "departments:view",
    "attendance:view", "attendance:employee_dashboard",
    "leave:view", "leave:approve",
    "tasks:view", "tasks:create", "tasks:edit", "tasks:assign",
    "work-records:view", "work-records:approve",
    "announcements:view",
    "mail:view", "mail:create",
  ],
  "Employee": [
    "dashboard:view",
    "attendance:view", "attendance:create",
    "leave:view", "leave:create",
    "tasks:view",
    "work-records:view", "work-records:create",
    "holidays:view",
    "announcements:view",
    "mail:view", "mail:create",
  ],
};

// ─── Data Scope ─────────────────────────────────────────────────────────────
// Determines whose data a user can access

export type DataScope = "all" | "department" | "self";

export function getDataScope(user: SessionUser | null): DataScope {
  if (!user) return "self";
  if (user.accountType === "super_admin") return "all";

  const perms = user.rolePermissions ?? [];

  // Users with staff:view_sensitive or staff:* can see all employees
  if (perms.includes("*") || perms.includes("staff:*") || perms.includes("staff:view_sensitive")) {
    return "all";
  }

  // Managers can see their department
  if (perms.includes("attendance:manage") || perms.includes("staff:edit")) {
    return "department";
  }

  return "self";
}

// ─── Sensitive Field Protection ─────────────────────────────────────────────
// Fields that should never be exposed to non-admin users

export const SENSITIVE_EMPLOYEE_FIELDS = {
  safe: {
    id: true, employeeId: true, name: true, email: true, phone: true,
    avatar: true, departmentId: true, positionId: true, employmentType: true,
    joinDate: true, status: true, workLocation: true, gender: true,
  },
  sensitive: {
    baseSalary: true, salaryType: true, bankName: true, bankAccountNumber: true,
    accountHolder: true, taxId: true, deviceEmployeeId: true, shift: true,
  },
  admin: {
    address: true, city: true, country: true, dateOfBirth: true,
    emergencyName: true, emergencyPhone: true, emergencyRelation: true,
    contractEndDate: true, paymentMethod: true,
  },
};

export function getSafeEmployeeSelect(user: SessionUser | null) {
  const scope = getDataScope(user);
  const perms = user?.rolePermissions ?? [];
  const canViewSensitive = perms.includes("*") || perms.includes("staff:view_sensitive") || perms.includes("staff:*");

  const select: Record<string, boolean> = { ...SENSITIVE_EMPLOYEE_FIELDS.safe };

  if (canViewSensitive || scope === "all") {
    Object.assign(select, SENSITIVE_EMPLOYEE_FIELDS.sensitive);
  }

  // Only admin/HR can see personal details
  if (scope === "all" && (canViewSensitive || perms.includes("settings:*"))) {
    Object.assign(select, SENSITIVE_EMPLOYEE_FIELDS.admin);
  }

  return select;
}

// ─── Core Permission Check ──────────────────────────────────────────────────

export function hasPermission(
  user: SessionUser | null,
  module: string,
  action: PermissionAction = "view"
): boolean {
  if (!user) return false;

  // Super Admin has all permissions
  if (user.accountType === "super_admin") return true;

  // Check role permissions - NO MORE Workspace Admin bypass
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

// ─── Data Access Verification ───────────────────────────────────────────────

export function canAccessEmployee(
  user: SessionUser | null,
  targetEmployeeId: string,
  targetDepartmentId?: string | null
): boolean {
  if (!user) return false;
  if (user.accountType === "super_admin") return true;

  const perms = user.rolePermissions ?? [];

  // Full access
  if (perms.includes("*") || perms.includes("staff:*") || perms.includes("staff:view_sensitive")) {
    return true;
  }

  // Self access
  if (user.employeeId === targetEmployeeId) return true;

  // Department access for managers
  if (
    targetDepartmentId &&
    (perms.includes("attendance:manage") || perms.includes("staff:edit")) &&
    user.departmentId === targetDepartmentId
  ) {
    return true;
  }

  return false;
}

export function canModifyEmployee(
  user: SessionUser | null,
  targetEmployeeId: string,
  targetDepartmentId?: string | null
): boolean {
  if (!user) return false;
  if (user.accountType === "super_admin") return true;

  const perms = user.rolePermissions ?? [];

  // Full modify access
  if (perms.includes("*") || perms.includes("staff:*")) {
    return true;
  }

  // Edit access (HR/Admin)
  if (perms.includes("staff:edit")) {
    // For department managers, only their department
    if (targetDepartmentId && user.departmentId === targetDepartmentId) return true;
    // For HR managers, all employees
    if (perms.includes("staff:view_sensitive")) return true;
  }

  return false;
}

// ─── Module-to-Permission Mapping ───────────────────────────────────────────

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

// Routes that require specific permissions (checked server-side)
export const PROTECTED_ROUTES: Record<string, { module: string; action: PermissionAction }> = {
  "/settings": { module: "settings", action: "edit" },
  "/settings/auth": { module: "settings", action: "auth" },
  "/subscription": { module: "subscription", action: "manage" },
  "/audit-logs": { module: "audit-logs", action: "view" },
  "/staff/new": { module: "staff", action: "create" },
  "/attendance/settings": { module: "attendance", action: "settings" },
  "/payroll/preview": { module: "payroll", action: "preview" },
  "/payroll/periods": { module: "payroll", action: "periods" },
  "/super-admin": { module: "_super_admin", action: "view" },
};

export function throwAccessDenied(): never {
  throw new Error("ACCESS_DENIED");
}
