import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { parsePermissions } from "@/lib/permissions";
import { isAccountLocked, recordFailedLogin, resetFailedLogins } from "@/services/password";
import { getAuthSettings } from "@/services/otp";
import { logAuthEvent } from "@/services/auth-audit";

const SESSION_COOKIE = "astrapulse_session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { workspace: true, role: true, employee: true },
    });

    if (!user || user.status === "inactive") {
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }

    if (user.status === "pending") {
      return NextResponse.json({ ok: false, error: "Please verify your email before signing in" }, { status: 403 });
    }

    const lockStatus = await isAccountLocked(user.id);
    if (lockStatus.locked) {
      await logAuthEvent({
        workspaceId: user.workspaceId,
        userId: user.id,
        email,
        action: "login",
        success: false,
        metadata: { reason: "account_locked" },
      });
      return NextResponse.json({ ok: false, error: "Account is temporarily locked" }, { status: 423 });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      const authSettings = await getAuthSettings(user.workspaceId);
      const lockResult = await recordFailedLogin(
        user.id,
        authSettings.maxFailedLoginAttempts,
        authSettings.lockoutDurationMinutes
      );
      await logAuthEvent({
        workspaceId: user.workspaceId,
        userId: user.id,
        email,
        action: "login",
        success: false,
        metadata: { reason: "invalid_password", remainingAttempts: lockResult.remainingAttempts },
      });
      if (lockResult.locked) {
        return NextResponse.json({ ok: false, error: "Account has been locked due to too many failed attempts" }, { status: 423 });
      }
      return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }

    await logAuthEvent({
      workspaceId: user.workspaceId,
      userId: user.id,
      email,
      action: "login",
      success: true,
    });

    await resetFailedLogins(user.id);

    const rolePermissions = parsePermissions(user.role?.permissions ?? "[]");
    const accountType = user.accountType ?? "organization";

    const authSettings = await getAuthSettings(user.workspaceId);
    if (authSettings.loginOtpEnabled) {
      return NextResponse.json({
        ok: true,
        requiresOtp: true,
        email: user.email,
      });
    }

    const token = await createSession({
      id: user.id,
      workspaceId: user.workspaceId,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? "Employee",
      rolePermissions,
      accountType,
      employeeId: user.employeeId ?? null,
      departmentId: user.employee?.departmentId ?? null,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const response = NextResponse.json({
      ok: true,
      accountType,
      redirect: accountType === "super_admin" ? "/super-admin" : "/",
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
