import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Public verification code for certificates, e.g. "EKA-7Q4M-X2PD" */
export function certificateCode() {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `EKA-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/** Human-friendly document numbers: P-2026-4F7K2Q (purchase), C-2026-… (contract) */
export function docNumber(prefix: "P" | "C") {
  const bytes = crypto.randomBytes(6);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}-${new Date().getFullYear()}-${chars}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/['‘’ʻʼ`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
