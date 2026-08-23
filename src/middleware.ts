import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { PROTECTED_ROUTES, SUPER_ADMIN_ROUTES } from "@/lib/permissions";

const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "").replace(/^"|"$/g, "")
);
const SESSION_COOKIE = "astrapulse_session";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify", "/_next", "/favicon", "/api"];

function parsePermissions(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

    const rolePermissions = parsePermissions(payload.rolePermissions);

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
