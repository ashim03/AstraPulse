import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "astrapulse-dev-secret-change-in-production").replace(/^"|"$/g, "")
);
const SESSION_COOKIE = "astrapulse_session";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify", "/_next", "/favicon", "/api"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isPublic) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET);
        const accountType = payload.accountType as string;
        
        // Redirect logged-in users away from public pages
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

    // Super admin can only access /super-admin routes
    if (isSuperAdmin && !isSuperAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/super-admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Non-super-admin cannot access /super-admin routes
    if (!isSuperAdmin && isSuperAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
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
