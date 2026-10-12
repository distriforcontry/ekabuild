"use client";
import * as React from "react";
import { DocumentDownload, Eye, Lock1 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import type { DocumentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { downloadUrl } from "../FilePreviewDialog";
import { fileKind, FileTypeIcon } from "../FileTypeIcon";
import { useFmt } from "../format";
import { HashChip } from "../ui";

/** One document line: type icon, title, meta, sha256, preview & download. */
export function DocumentRow({ doc, onPreview, className }: { doc: DocumentItem; onPreview?: (d: DocumentItem) => void; className?: string }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const file = doc.file;
  const previewable = file ? ["image", "pdf", "video"].includes(fileKind(file.mime, file.originalName)) : false;
  const sha = doc.sha256 || file?.sha256 || null;

  return (
    <div className={cn("group flex flex-col gap-3 rounded-xl border border-line bg-ink-850/40 p-3.5 transition hover:border-line-strong hover:bg-ink-850 sm:flex-row sm:items-center", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <FileTypeIcon mime={file?.mime} name={file?.originalName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-stone-100">{tr(doc.title)}</span>
            {doc.version > 1 && <span className="rounded bg-fg/5 px-1.5 font-mono text-[10px] text-ink-300">{t("app.files.version", { n: doc.version })}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
            <span>{label("documentType", doc.type)}</span>
            {doc.number && <span className="font-mono">№ {doc.number}</span>}
            {file && <span className="font-mono">{fmt.bytes(file.size)}</span>}
            {doc.issuedAt && <span>{t("app.files.issued", { date: fmt.date(doc.issuedAt) })}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[54px] sm:pl-0">
        {doc.status !== "VERIFIED" && <StatusBadge kind="verification" value={doc.status} />}
        {sha && <HashChip value={sha} />}
        {doc.locked || !file ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-400">
            <Lock1 size={14} /> {t("app.files.locked")}
          </span>
        ) : (
          <>
            {previewable && onPreview && (
              <Tooltip content={t("app.common.preview")}>
                <Button size="icon-sm" variant="ghost" onClick={() => onPreview(doc)} aria-label={t("app.common.preview")}>
                  <Eye size={16} />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t("app.common.download")}>
              <Button asChild size="icon-sm" variant="secondary" aria-label={t("app.common.download")}>
                <a href={downloadUrl(file.url)} download={file.originalName}>
                  <DocumentDownload size={16} />
                </a>
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
