import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "").replace(/^"|"$/g, "")
);
const SESSION_COOKIE = "astrapulse_session";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/_next", "/favicon", "/api", "/manifest.json", "/sw.js", "/icons", "/api/keep-alive"];

const ROLE_DEFAULTS: Record<string, string[]> = {
  "Workspace Admin": ["dashboard:view","analytics:view","staff:*","departments:*","attendance:*","leave:*","holidays:*","tasks:*","work-records:*","advances:*","payroll:*","expenses:*","income:*","accounting:*","invoices:*","payments:*","reports:*","announcements:*","mail:*","audit-logs:*","settings:*","subscription:*","users:*","roles:*"],
  "HR Manager": ["dashboard:view","analytics:view","staff:view","staff:create","staff:edit","staff:view_sensitive","departments:view","attendance:view","attendance:edit","attendance:manage","attendance:reports","attendance:employee_dashboard","leave:view","leave:create","leave:approve","holidays:view","holidays:create","tasks:view","tasks:create","tasks:assign","work-records:view","work-records:approve","advances:view","payroll:view","reports:view","reports:export","announcements:view","announcements:create","mail:view","mail:create"],
  "HR Staff": ["dashboard:view","staff:view","staff:create","departments:view","attendance:view","attendance:edit","attendance:reports","leave:view","leave:create","holidays:view","tasks:view","work-records:view","announcements:view","mail:view","mail:create"],
  "Finance Manager": ["dashboard:view","analytics:view","staff:view","attendance:view","payroll:view","payroll:create","payroll:approve","payroll:manage","payroll:preview","payroll:periods","expenses:view","expenses:create","expenses:edit","expenses:approve","income:view","income:create","income:edit","accounting:view","accounting:create","accounting:edit","invoices:view","invoices:create","invoices:edit","invoices:approve","payments:view","payments:create","payments:edit","reports:view","reports:export","advances:view","advances:approve"],
  "Payroll Staff": ["dashboard:view","staff:view","attendance:view","payroll:view","payroll:create","payroll:preview","expenses:view","reports:view"],
  "Manager": ["dashboard:view","staff:view","departments:view","attendance:view","attendance:employee_dashboard","leave:view","leave:approve","tasks:view","tasks:create","tasks:edit","tasks:assign","work-records:view","work-records:approve","announcements:view","mail:view","mail:create"],
  "Employee": ["dashboard:view","attendance:view","attendance:create","leave:view","leave:create","tasks:view","work-records:view","work-records:create","holidays:view","announcements:view","mail:view","mail:create"],
};

const PROTECTED_ROUTES: Record<string, { module: string; action: string }> = {
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

function hasPermission(rolePermissions: string[], module: string, action: string): boolean {
  return (
    rolePermissions.includes("*") ||
    rolePermissions.includes(`${module}:*`) ||
    rolePermissions.includes(`${module}:${action}`) ||
    rolePermissions.includes(module)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublic) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET);
        const accountType = payload.accountType as string;

        if (pathname.startsWith("/login") || pathname === "/") {
          const url = request.nextUrl.clone();
          url.pathname = accountType === "super_admin" ? "/super-admin" : "/";
          url.search = "";
          return NextResponse.redirect(url);
        }
      } catch {
        // invalid token -> allow public access
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const accountType = payload.accountType as string;
    const isSuperAdmin = accountType === "super_admin";
    const isSuperAdminRoute = pathname.startsWith("/super-admin");

    if (isSuperAdmin && !isSuperAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/super-admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!isSuperAdmin && isSuperAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (isSuperAdmin) {
      return NextResponse.next();
    }

    const role = (payload.role as string) || "Employee";
    const rolePermissions = ROLE_DEFAULTS[role] ?? [];

    // Check exact match first, then try progressively shorter prefixes
    let matchedRoute: { module: string; action: string } | null = null;
    const normalizedPath = pathname.endsWith("/") && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;

    // Try exact match, then parent paths
    const candidates = [normalizedPath];
    const parts = normalizedPath.split("/").filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      candidates.push("/" + parts.slice(0, i).join("/"));
    }

    for (const candidate of candidates) {
      if (PROTECTED_ROUTES[candidate]) {
        matchedRoute = PROTECTED_ROUTES[candidate];
        break;
      }
    }

    if (matchedRoute && matchedRoute.module !== "_super_admin") {
      if (!hasPermission(rolePermissions, matchedRoute.module, matchedRoute.action)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "?error=access_denied";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"],
};
