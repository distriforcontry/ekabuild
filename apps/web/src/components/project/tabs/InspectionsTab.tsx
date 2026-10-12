"use client";
import * as React from "react";
import { motion } from "motion/react";
import { Calendar, Clock, SearchStatus, TickCircle, UserTick, Warning2 } from "iconsax-reactjs";
import type { InspectionItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/components/catalog/use-format";
import { isImage } from "@/components/catalog/format";
import { useProject } from "../ProjectProvider";
import { Lightbox, type LightboxItem } from "../Lightbox";
import { FileChip, Thumb, downloadUrl } from "../bits";

const SEV = {
  LOW: { tone: "info" as const, bar: "bg-info" },
  MEDIUM: { tone: "warning" as const, bar: "bg-warning" },
  HIGH: { tone: "danger" as const, bar: "bg-danger" },
};
const RESULT_BORDER: Record<string, string> = { PASSED: "before:bg-success", ISSUES: "before:bg-warning", FAILED: "before:bg-danger" };

export function InspectionsTab() {
  const { project: p } = useProject();
  const { t } = useI18n();
  const list = React.useMemo(
    () => [...(p.inspections ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [p.inspections],
  );
  const [lb, setLb] = React.useState<{ items: LightboxItem[]; index: number; title: string } | null>(null);

  if (!list.length) {
    return <EmptyState icon={SearchStatus} title={t("catalog.inspections.empty")} description={t("catalog.inspections.emptyHint")} className="py-20" />;
  }

  const stats = [
    { label: t("catalog.inspections.total"), value: list.length, cls: "text-stone-100" },
    { label: t("catalog.inspections.passed"), value: list.filter((i) => i.result === "PASSED").length, cls: "text-success" },
    { label: t("catalog.inspections.issues"), value: list.filter((i) => i.result === "ISSUES").length, cls: "text-warning" },
    { label: t("catalog.inspections.failed"), value: list.filter((i) => i.result === "FAILED").length, cls: "text-danger" },
    {
      label: t("catalog.inspections.openViolations"),
      value: list.reduce((n, i) => n + (i.violations ?? []).filter((v) => !v.resolved).length, 0),
      cls: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className={cn("rounded-2xl border border-line bg-ink-900/80 p-4 shadow-card", i === 4 && "col-span-2 sm:col-span-1")}
          >
            <div className="text-[11px] uppercase tracking-wider text-ink-400">{s.label}</div>
            <div className={cn("mt-1 font-mono text-2xl font-semibold", s.cls)}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {list.map((ins, i) => (
          <motion.div
            key={ins.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: Math.min(i, 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <InspectionCard
              ins={ins}
              onOpen={(index) => {
                const items = ins.files
                  .filter((f) => isImage(f.mime, f.originalName))
                  .map((f) => ({ src: f.url, alt: f.originalName, caption: ins.summary, download: downloadUrl(f) }));
                setLb({ items, index, title: f_title(ins) });
              }}
            />
          </motion.div>
        ))}
      </div>

      {lb && <Lightbox items={lb.items} index={lb.index} onIndexChange={(index) => setLb((s) => (s ? { ...s, index } : s))} open onOpenChange={(o) => !o && setLb(null)} title={lb.title} />}
    </div>
  );
}

const f_title = (ins: InspectionItem) => ins.inspector?.fullName ?? ins.id;

function InspectionCard({ ins, onOpen }: { ins: InspectionItem; onOpen: (i: number) => void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const images = ins.files.filter((f) => isImage(f.mime, f.originalName));
  const files = ins.files.filter((f) => !isImage(f.mime, f.originalName));
  const violations = ins.violations ?? [];

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border border-line bg-ink-900/80 p-5 pl-6 shadow-card before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] md:p-6 md:pl-7",
        RESULT_BORDER[ins.result] ?? "before:bg-ink-600",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-stone-100">{label("inspectionType", ins.type)}</h4>
            <StatusBadge kind="inspectionResult" value={ins.result} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} /> {fmt.date(ins.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserTick size={13} /> {t("catalog.inspections.inspector")}:{" "}
              <span className="text-ink-200">{tr(ins.inspector?.fullName)}</span>
              {ins.inspector?.organization && <span>· {tr(ins.inspector.organization)}</span>}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-ink-200">{tr(ins.summary)}</p>
      {ins.notes && (
        <p className="mt-2 rounded-xl border border-line bg-ink-850 px-3 py-2 text-sm text-ink-300">
          <span className="font-semibold text-ink-200">{t("catalog.inspections.notes")}: </span>
          {tr(ins.notes)}
        </p>
      )}

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.inspections.violations")}</div>
        {violations.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <TickCircle size={16} variant="Bold" /> {t("catalog.inspections.noViolations")}
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {violations.map((v, i) => {
              const s = SEV[v.severity] ?? SEV.LOW;
              return (
                <li key={`${v.code}-${i}`} className={cn("flex items-start gap-3 bg-ink-850/60 px-4 py-3", v.resolved && "opacity-75")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", s.bar)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-300">{v.code}</span>
                      <Badge tone={s.tone}>{t(`catalog.inspections.severity.${v.severity}`)}</Badge>
                    </div>
                    <p className={cn("mt-1 text-sm text-ink-100", v.resolved && "line-through decoration-ink-500")}>{tr(v.text)}</p>
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", v.resolved ? "text-success" : "text-warning")}>
                    {v.resolved ? <TickCircle size={15} variant="Bold" /> : <Clock size={15} variant="Bold" />}
                    <span className="hidden sm:inline">{v.resolved ? t("catalog.inspections.resolved") : t("catalog.inspections.unresolved")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(images.length > 0 || files.length > 0) && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.inspections.files")}</div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((f, i) => (
                <Thumb key={f.id} src={f.url} alt={f.originalName} onClick={() => onOpen(i)} className="aspect-square rounded-xl border border-line" />
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <FileChip key={f.id} file={f} />
              ))}
            </div>
          )}
        </div>
      )}
      {violations.some((v) => v.severity === "HIGH" && !v.resolved) && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          <Warning2 size={15} variant="Bold" /> {t("catalog.inspections.unresolved")} · {t("catalog.inspections.severity.HIGH")}
        </div>
      )}
    </article>
  );
}
