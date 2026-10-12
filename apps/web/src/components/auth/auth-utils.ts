import { ApiError } from "@/lib/api";
import type { MessageKey } from "@/i18n/core";

// ───────────── Phone (+998 XX XXX XX XX) ─────────────

/** National 9 digits from anything the user typed or pasted ("+998 (90) 123-45-67", "998901234567", "901234567"). */
export function nationalDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  // legacy domestic prefix "8 90 …"
  if (d.length === 10 && d.startsWith("8")) d = d.slice(1);
  return d.slice(0, 9);
}

/** National digits of a (possibly partial) E.164 value produced by PhoneInput ("+99890" → "90"). */
export function digitsFromE164(v: string): string {
  if (v.startsWith("+998")) return v.slice(4).replace(/\D/g, "").slice(0, 9);
  return nationalDigits(v);
}

/** "901234567" → "90 123 45 67" (partial input is formatted progressively) */
export function formatNational(digits: string): string {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

export const toE164 = (digits: string) => (digits ? `+998${digits}` : "");
export const isValidPhone = (e164: string) => /^\+998\d{9}$/.test(e164);

/** "+998901234567" → "+998 90 123 45 67" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const d = nationalDigits(e164);
  return d.length === 9 ? `+998 ${formatNational(d)}` : e164;
}

// ───────────── Password strength ─────────────

export type PasswordChecks = { length: boolean; mixed: boolean; digit: boolean; symbol: boolean };

export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

/** 0 (empty) … 4 (strong) */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  const c = passwordChecks(pw);
  let s = 0;
  if (c.length) s++;
  if (c.mixed) s++;
  if (c.digit) s++;
  if (c.symbol) s++;
  if (pw.length >= 12 && s >= 3) s = 4;
  if (!c.length) s = Math.min(s, 1);
  return Math.max(1, Math.min(4, s)) as 1 | 2 | 3 | 4;
}

/** Returns an i18n key describing why the password is not acceptable, or null. */
export function passwordProblem(pw: string): MessageKey | null {
  if (!pw) return "auth.password.required";
  if (pw.length < 8) return "auth.password.tooShort";
  const c = passwordChecks(pw);
  if (!/[A-Za-z]/.test(pw) || !(c.digit || c.symbol)) return "auth.password.tooWeak";
  return null;
}

// ───────────── Errors ─────────────

const AUTH_CODES = [
  "PHONE_TAKEN",
  "USER_NOT_FOUND",
  "TOO_MANY",
  "INVALID_CODE",
  "CODE_EXPIRED",
  "INVALID_CREDENTIALS",
  "BLOCKED",
  "TOKEN_EXPIRED",
  "VALIDATION",
] as const;

/** Friendly, translated message for auth API errors. */
export function authErrorMessage(e: unknown, t: (k: MessageKey) => string): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t("common.errors.network");
    if ((AUTH_CODES as readonly string[]).includes(e.code)) return t(`auth.errors.${e.code as (typeof AUTH_CODES)[number]}`);
    if (e.status === 429) return t("auth.errors.TOO_MANY");
    if (e.status === 400 || e.status === 422) return e.message || t("auth.errors.VALIDATION");
    if (e.status >= 500) return t("common.errors.generic");
    return e.message || t("common.errors.generic");
  }
  return t("common.errors.generic");
}

export const errorCode = (e: unknown) => (e instanceof ApiError ? e.code : null);

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/register") || next.startsWith("/forgot")) return null;
  return next;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// ───────────── API shapes ─────────────

export type OtpPurpose = "REGISTER" | "LOGIN" | "RESET";
export type OtpSendResponse = { sent: boolean; expiresIn?: number; resendIn?: number; devCode?: string };
