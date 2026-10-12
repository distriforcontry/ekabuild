import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { FastifyReply } from "fastify";
import type { Role } from "@prisma/client";
import { env, isProd } from "../env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export const ACCESS_COOKIE = "eka_at";
export const REFRESH_COOKIE = "eka_rt";

export type AccessClaims = { sub: string; role: Role; org?: string | null };

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ role: claims.role, org: claims.org ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("ekabuild")
    .setExpirationTime(`${env.ACCESS_TTL_MIN}m`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "ekabuild" });
    return { sub: payload.sub!, role: payload.role as Role, org: (payload.org as string | null) ?? null };
  } catch {
    return null;
  }
}

/** Short-lived token proving a phone was verified by OTP (register / reset). */
export async function signPhoneToken(phone: string, purpose: string) {
  return new SignJWT({ phone, purpose }).setProtectedHeader({ alg: "HS256" }).setIssuer("ekabuild-otp").setExpirationTime("15m").sign(secret);
}

export async function verifyPhoneToken(token: string, purpose: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "ekabuild-otp" });
    return payload.purpose === purpose ? (payload.phone as string) : null;
  } catch {
    return null;
  }
}

const baseCookie = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export function setAuthCookies(reply: FastifyReply, access: string, refresh: string) {
  reply.setCookie(ACCESS_COOKIE, access, { ...baseCookie(), path: "/", maxAge: env.ACCESS_TTL_MIN * 60 });
  reply.setCookie(REFRESH_COOKIE, refresh, { ...baseCookie(), path: "/", maxAge: env.REFRESH_TTL_DAYS * 86400 });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: "/" });
  reply.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: "/" });
}

/** Normalises Uzbek phone numbers to +998XXXXXXXXX or returns null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}
