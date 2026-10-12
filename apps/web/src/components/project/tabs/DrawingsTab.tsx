"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { DocumentDownload, DocumentText, Eye, I3DCubeScan, Lock, Login, RulerPen } from "iconsax-reactjs";
import type { DocumentType } from "@eka/shared";
import type { DocumentItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useFormat } from "@/components/catalog/use-format";
import { isImage, isModel, isPdf } from "@/components/catalog/format";
import { useProject } from "../ProjectProvider";
import { FileViewerDialog } from "../FileViewerDialog";
import { ShaChip, downloadUrl } from "../bits";

export const DRAWING_TYPES: DocumentType[] = ["DRAWING", "FLOOR_PLAN", "MODEL_3D"];

export function DrawingsTab() {
  const { project: p } = useProject();
  const { t, label } = useI18n();
  const docs = (p.documents ?? []).filter((d) => DRAWING_TYPES.includes(d.type));
  const [filter, setFilter] = React.useState<DocumentType | "ALL">("ALL");
  const [viewing, setViewing] = React.useState<DocumentItem | null>(null);
  const types = DRAWING_TYPES.filter((ty) => docs.some((d) => d.type === ty));
  const shown = filter === "ALL" ? docs : docs.filter((d) => d.type === filter);

  if (!docs.length) {
    return <EmptyState icon={RulerPen} title={t("catalog.drawings.empty")} description={t("catalog.drawings.emptyHint")} className="py-20" />;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-3xl text-stone-100">{t("catalog.drawings.title")}</h3>
          <p className="mt-1 text-sm text-ink-400">{t("catalog.drawings.subtitle")}</p>
        </div>
        {types.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {(["ALL", ...types] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  filter === f ? "border-gold-500/40 bg-gold-500/12 text-gold-200" : "border-line text-ink-300 hover:border-line-strong hover:text-stone-100",
                )}
              >
                {f === "ALL" ? t("catalog.drawings.filters.all") : label("documentType", f)}
              </button>
            ))}
          </div>
        )}
      </div>

      <motion.ul layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((d, i) => (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <DrawingCard doc={d} onOpen={() => setViewing(d)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <FileViewerDialog file={viewing?.file ?? null} title={viewing?.title ?? ""} open={Boolean(viewing?.file)} onOpenChange={(o) => !o && setViewing(null)} />
    </div>
  );
}

function DrawingCard({ doc, onOpen }: { doc: DocumentItem; onOpen: () => void }) {
  const { project: p, buy, loginHref, packagePurchase } = useProject();
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const f = doc.file;
  const locked = doc.locked || !f;
  const [imgFailed, setImgFailed] = React.useState(false);
  const TypeIcon = doc.type === "MODEL_3D" ? I3DCubeScan : doc.type === "FLOOR_PLAN" ? RulerPen : DocumentText;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card transition-all duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-850">
        {locked ? (
          <>
            <div className="bg-blueprint absolute inset-0 scale-110 blur-[3px]" />
            <svg viewBox="0 0 200 150" className="absolute inset-0 size-full opacity-40 blur-[2px]" aria-hidden>
              <g fill="none" className="stroke-gold-400" strokeWidth="1.2">
                <rect x="30" y="20" width="140" height="110" />
                <path d="M30 70h60v60M90 20v50h80M120 70v60M60 20v30h30" />
                <circle cx="150" cy="40" r="8" />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/40 p-5 text-center backdrop-blur-[2px]">
              <span className="grid size-12 place-items-center rounded-2xl border border-gold-500/30 bg-ink-900/80 text-gold-300 shadow-glow">
                <Lock size={22} variant="Bulk" />
              </span>
              <div className="text-sm font-medium text-stone-100">{t("catalog.drawings.locked")}</div>
              {!p.viewer.authenticated ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={loginHref("drawings")}>
                    <Login size={14} />
                    {t("catalog.drawings.login")}
                  </Link>
                </Button>
              ) : packagePurchase ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/purchases/${packagePurchase.id}`}>{t("catalog.detail.actions.packagePending")}</Link>
                </Button>
              ) : p.packagePrice ? (
                <Button variant="gold" size="sm" onClick={() => buy({ kind: "DOCUMENT_PACKAGE" })}>
                  {t("catalog.drawings.buy")}
                </Button>
              ) : (
                <p className="max-w-56 text-xs text-ink-300">{t("catalog.drawings.lockedHint")}</p>
              )}
            </div>
          </>
        ) : f && isImage(f.mime, f.originalName) && !imgFailed ? (
          <button type="button" onClick={onOpen} className="absolute inset-0 cursor-zoom-in" aria-label={`${t("catalog.drawings.open")}: ${tr(doc.title)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.url}
              alt={tr(doc.title)}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </button>
        ) : (
          <button type="button" onClick={onOpen} className="bg-blueprint absolute inset-0 grid cursor-pointer place-items-center" aria-label={`${t("catalog.drawings.open")}: ${tr(doc.title)}`}>
            <span className="flex flex-col items-center gap-2">
              <span className="grid size-16 place-items-center rounded-2xl border border-gold-500/25 bg-ink-900/80 text-gold-300 transition-transform duration-500 group-hover:scale-110">
                <TypeIcon size={30} variant="Bulk" />
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-ink-300">
                {f && isPdf(f.mime, f.originalName) ? "PDF" : f && isModel(f.mime, f.originalName) ? "GLB" : f?.originalName.split(".").pop()}
              </span>
            </span>
          </button>
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
          <Badge tone="neutral" className="bg-ink-950/60 backdrop-blur">
            {label("documentType", doc.type)}
          </Badge>
          {doc.version > 1 && (
            <Badge tone="gold" className="bg-ink-950/60 font-mono backdrop-blur">
              {t("catalog.drawings.version", { n: doc.version })}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h4 className="line-clamp-2 font-semibold text-stone-100">{tr(doc.title)}</h4>
        {(doc.number || doc.issuer) && (
          <p className="mt-1 truncate text-xs text-ink-400">{[doc.number, doc.issuer ? tr(doc.issuer) : null].filter(Boolean).join(" · ")}</p>
        )}
        {doc.description && <p className="mt-2 line-clamp-2 text-sm text-ink-300">{tr(doc.description)}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          {f ? <ShaChip sha={f.sha256} /> : <span className="text-xs text-ink-400">{fmt.date(doc.createdAt)}</span>}
          {f && !locked && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label={t("catalog.drawings.open")} title={t("catalog.drawings.open")}>
                {isModel(f.mime, f.originalName) ? <I3DCubeScan size={16} /> : <Eye size={16} />}
              </Button>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={downloadUrl(f)} aria-label={t("catalog.file.download")} title={`${t("catalog.file.download")} · ${fmt.bytes(f.size)}`}>
                  <DocumentDownload size={16} />
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
