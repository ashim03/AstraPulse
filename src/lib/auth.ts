import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const SESSION_COOKIE = "astrapulse_session";
const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "").replace(/^"|"$/g, "")
);

export type SessionUser = {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: string;
  rolePermissions: string[];
  accountType: string;
  employeeId: string | null;
};

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(redirectTo = "/login"): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSession(user);
  const store = cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.id },
    include: {
      workspace: { include: { subscription: true } },
      role: true,
      employee: true,
    },
  });
}

// ---- TOTP two-factor (RFC 6238) ----
export function generateTotpSecret(): string {
  return crypto.randomBytes(20).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, stepSeconds = 30): string {
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string): boolean {
  const cleaned = code.trim();
  if (!/^\d{6}$/.test(cleaned)) return false;
  const current = totpCode(secret);
  const previous = totpCode(secret, 30);
  // allow small clock skew by comparing current and a step behind
  const prevBuf = Buffer.alloc(8);
  const counter = Math.floor(Date.now() / 1000 / 30) - 1;
  prevBuf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(prevBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const prevCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const prev = (prevCode % 1_000_000).toString().padStart(6, "0");
  return cleaned === current || cleaned === prev;
}

export function totpProvisioningUri(secret: string, account: string, issuer = "AstraPulse"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}