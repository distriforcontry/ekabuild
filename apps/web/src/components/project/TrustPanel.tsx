"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Clock, CloseCircle, Eye, InfoCircle, ScanBarcode, TickCircle, Warning2 } from "iconsax-reactjs";
import { trustLevel } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { TrustRing } from "@/components/ui/trust-ring";
import { Tooltip } from "@/components/ui/tooltip";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "./ProjectProvider";

type CheckTone = "ok" | "warn" | "bad" | "pending";
const TONE: Record<CheckTone, { icon: typeof TickCircle; cls: string }> = {
  ok: { icon: TickCircle, cls: "text-success" },
  warn: { icon: Warning2, cls: "text-warning" },
  bad: { icon: CloseCircle, cls: "text-danger" },
  pending: { icon: Clock, cls: "text-ink-400" },
};
const BAR: Record<string, string> = { success: "bg-success", info: "bg-info", warning: "bg-warning", danger: "bg-danger" };
const TEXT: Record<string, string> = { success: "text-success", info: "text-info", warning: "text-warning", danger: "text-danger" };

/** Sticky side panel: trust ring, breakdown bars, verification summary. */
export function TrustPanel() {
  const { project: p } = useProject();
  const { t, tr } = useI18n();
  const fmt = useFormat();
  const level = trustLevel(p.trustScore);
  const now = Date.now();

  const certs = p.certificates ?? [];
  const verifiedCerts = certs.filter((c) => c.status === "VERIFIED").length;
  const expired = certs.filter((c) => c.status === "EXPIRED" || (c.validUntil && new Date(c.validUntil).getTime() < now)).length;
  const permitOk =
    certs.some((c) => c.type === "BUILDING_PERMIT" && c.status === "VERIFIED") ||
    (p.documents ?? []).some((d) => d.type === "BUILDING_PERMIT" && d.status === "VERIFIED");
  const inspections = p.inspections ?? [];
  const openViolations = inspections.reduce((n, i) => n + (i.violations ?? []).filter((v) => !v.resolved).length, 0);
  const cad = p.cadastre?.result;

  const checks: { tone: CheckTone; text: string }[] = [
    { tone: p.developer.status === "VERIFIED" ? "ok" : "pending", text: p.developer.status === "VERIFIED" ? t("catalog.checks.developer") : t("catalog.checks.developerPending") },
    { tone: p.verificationStatus === "VERIFIED" ? "ok" : "pending", text: p.verificationStatus === "VERIFIED" ? t("catalog.checks.project") : t("catalog.checks.projectPending") },
    { tone: permitOk ? "ok" : "warn", text: permitOk ? t("catalog.checks.permit") : t("catalog.checks.permitMissing") },
    {
      tone: !cad ? "pending" : cad === "MATCH" ? "ok" : cad === "PARTIAL" ? "warn" : "bad",
      text: !cad
        ? t("catalog.checks.cadastreNone")
        : cad === "MATCH"
          ? t("catalog.checks.cadastre")
          : cad === "PARTIAL"
            ? t("catalog.checks.cadastrePartial")
            : t("catalog.checks.cadastreBad"),
    },
    {
      tone: certs.length === 0 ? "pending" : verifiedCerts === certs.length ? "ok" : "warn",
      text: certs.length ? t("catalog.checks.certificates", { verified: verifiedCerts, total: certs.length }) : t("catalog.checks.certificatesNone"),
    },
    ...(expired ? [{ tone: "bad" as const, text: t("catalog.checks.expired", { count: expired }) }] : []),
    {
      tone: inspections.length ? "ok" : "pending",
      text: inspections.length ? t("catalog.checks.inspections", { count: inspections.length }) : t("catalog.checks.inspectionsNone"),
    },
    ...(openViolations ? [{ tone: "warn" as const, text: t("catalog.checks.openViolations", { count: openViolations }) }] : []),
  ];

  const breakdown = p.trustBreakdown ?? [];

  return (
    <div className="space-y-4">
      <div className="eka-border rounded-3xl shadow-card">
      <div aria-hidden className="eka-border-spin opacity-70" />
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-ink-900 p-5 md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <TrustRing score={p.trustScore} size={112} stroke={9} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
              {t("catalog.trust.title")}
              <Tooltip content={t("catalog.trust.howText")}>
                <button type="button" className="cursor-help text-ink-400 transition hover:text-gold-300" aria-label={t("catalog.trust.howTitle")}>
                  <InfoCircle size={14} variant="Bulk" />
                </button>
              </Tooltip>
            </div>
            <div className={cn("mt-1 font-display text-3xl leading-tight", TEXT[level.tone])}>{fmt.trustLabel(p.trustScore)}</div>
            <div className="mt-1 text-xs text-ink-400">{t("catalog.trust.subtitle")}</div>
          </div>
        </div>

        <div className="relative mt-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.trust.breakdown")}</div>
          {breakdown.length === 0 ? (
            <p className="text-sm text-ink-400">{t("catalog.trust.noBreakdown")}</p>
          ) : (
            <ul className="space-y-3.5">
              {breakdown.map((b, i) => {
                const ratio = b.max > 0 ? Math.max(0, Math.min(1, b.score / b.max)) : 0;
                const tone = ratio >= 0.85 ? "success" : ratio >= 0.6 ? "info" : ratio >= 0.35 ? "warning" : "danger";
                return (
                  <li key={b.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink-100">{tr(b.label)}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-300">
                        <b className="text-stone-100">{b.score}</b>/{b.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-fg/8">
                      <motion.div
                        className={cn("h-full origin-left rounded-full", BAR[tone])}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: ratio }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    {b.note && <p className="mt-1 text-xs leading-relaxed text-ink-400">{tr(b.note)}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </div>

      <div className="rounded-3xl border border-line bg-ink-900/80 p-5 shadow-card backdrop-blur-sm md:p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.trust.checks")}</div>
        <ul className="space-y-2.5">
          {checks.map((c, i) => {
            const T = TONE[c.tone];
            return (
              <motion.li
                key={c.text}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="flex items-start gap-2.5 text-sm text-ink-200"
              >
                <T.icon size={18} variant="Bold" className={cn("mt-px shrink-0", T.cls)} />
                {c.text}
              </motion.li>
            );
          })}
        </ul>
        <Link
          href="/verify"
          className="group mt-5 flex items-center justify-between gap-3 rounded-2xl border border-gold-500/25 bg-gold-500/6 px-4 py-3 text-sm font-medium text-gold-200 transition hover:border-gold-400/50 hover:bg-gold-500/10"
        >
          <span className="flex items-center gap-2">
            <ScanBarcode size={18} variant="Bulk" />
            {t("catalog.checks.verifyLink")}
          </span>
          <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
        </Link>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <Eye size={14} variant="Bulk" className="text-gold-400" />
          {t("catalog.trust.views", { count: fmt.num(p.views ?? 0) })}
        </div>
      </div>
    </div>
  );
}
