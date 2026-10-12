// Shared helpers for the visitor support chat (widget, contact form, CTA buttons).

export const SUPPORT_GUEST_KEY = "eka_support_guest";
export const SUPPORT_OPEN_EVENT = "eka:support-open";
export const SUPPORT_REFRESH_EVENT = "eka:support-refresh";

/** Open the floating support chat from anywhere on the page. */
export function openSupport() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUPPORT_OPEN_EVENT));
}

/** Ask the widget to reload the visitor's thread (e.g. after the contact form created one). */
export function refreshSupport() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUPPORT_REFRESH_EVENT));
}

export function readGuestToken(): string | null {
  try {
    return localStorage.getItem(SUPPORT_GUEST_KEY);
  } catch {
    return null;
  }
}

export function writeGuestToken(token: string) {
  try {
    localStorage.setItem(SUPPORT_GUEST_KEY, token);
  } catch {}
}

/**
 * Accepts "+998 90 123 45 67", "998901234567", "90 123 45 67" → "+998901234567".
 * Returns null when the number is not a valid Uzbek mobile/landline number.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}
