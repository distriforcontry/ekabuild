"use client";
import { Clock, CloseCircle, ShieldCross, Verify, Warning2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import type { LabelKind } from "@/i18n/core";
import { Badge } from "./badge";

type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";

const TONES: Record<string, Tone> = {
  // verification / certificates
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
  REVOKED: "danger",
  // project status
  PLANNING: "neutral",
  PERMITTED: "info",
  UNDER_CONSTRUCTION: "gold",
  COMPLETED: "success",
  COMMISSIONED: "success",
  SUSPENDED: "danger",
  // units
  AVAILABLE: "success",
  RESERVED: "warning",
  SOLD: "neutral",
  // purchases / contracts
  DRAFT: "neutral",
  PENDING_SIGNATURES: "warning",
  PARTIALLY_SIGNED: "info",
  SIGNED: "info",
  PAID: "success",
  CANCELLED: "danger",
  // inspections / cadastre
  PASSED: "success",
  ISSUES: "warning",
  FAILED: "danger",
  MATCH: "success",
  PARTIAL: "warning",
  MISMATCH: "danger",
  NOT_FOUND: "danger",
  ERROR: "danger",
  // complaints
  OPEN: "warning",
  IN_REVIEW: "info",
  RESOLVED: "success",
  DISMISSED: "neutral",
  // users
  ACTIVE: "success",
  BLOCKED: "danger",
};


/** Renders any enum value with its Uzbek label and semantic colour. */
export function StatusBadge({ kind, value, className }: { kind: LabelKind; value: string; className?: string }) {
  const { label } = useI18n();
  const tone = TONES[value] ?? "neutral";
  const Icon =
    value === "VERIFIED" || value === "PASSED" || value === "MATCH"
      ? Verify
      : value === "PENDING" || value === "PENDING_SIGNATURES"
        ? Clock
        : value === "REJECTED" || value === "FAILED" || value === "MISMATCH"
          ? ShieldCross
          : value === "EXPIRED" || value === "REVOKED"
            ? CloseCircle
            : value === "ISSUES" || value === "PARTIAL"
              ? Warning2
              : null;
  return (
    <Badge tone={tone} className={className} dot={!Icon}>
      {Icon && <Icon variant="Bold" />}
      {label(kind, value)}
    </Badge>
  );
}
