"use client";
import * as React from "react";
import { DocumentDownload, DocumentText, ExportSquare } from "iconsax-reactjs";
import { formatBytes } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import type { FileRef } from "@/lib/types";
import { CopyChip } from "./primitives";

/** Image / PDF preview dialog with SHA-256 and download. */
export function FilePreview({ file, title, open, onOpenChange, actions }: { file: FileRef | null; title?: string; open: boolean; onOpenChange: (o: boolean) => void; actions?: React.ReactNode }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => setLoaded(false), [file?.id]);
  const isImage = file?.mime.startsWith("image/");
  const isPdf = file?.mime === "application/pdf" || file?.originalName.toLowerCase().endsWith(".pdf");
  const dl = file ? `${file.url}${file.url.includes("?") ? "&" : "?"}download=1` : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex max-h-[92vh] flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{title ?? file?.originalName}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {file && (
              <>
                <span className="truncate">{file.originalName}</span>
                <span className="text-ink-500">·</span>
                <span className="font-mono text-xs">{formatBytes(file.size)}</span>
                <CopyChip value={file.sha256} display={`${t("admin.docs.sha")} ${file.sha256.slice(0, 12)}…`} />
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[50vh] flex-1 overflow-hidden bg-ink-950">
          {file && !loaded && (isImage || isPdf) && (
            <div className="absolute inset-0 grid place-items-center text-ink-400">
              <Spinner className="size-6" />
            </div>
          )}
          {file && isImage ? (
            <div className="grid h-full max-h-[64vh] place-items-center overflow-auto p-4">
              <img src={file.url} alt={file.originalName} onLoad={() => setLoaded(true)} className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-lift" />
            </div>
          ) : file && isPdf ? (
            <iframe src={file.url} title={file.originalName} onLoad={() => setLoaded(true)} className="h-[64vh] w-full border-0 bg-ink-950" />
          ) : (
            <div className="grid h-full min-h-[40vh] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/5 text-gold-300">
                  <DocumentText size={28} variant="Bulk" />
                </div>
                <p className="max-w-sm text-sm text-ink-300">{file ? t("admin.docs.noPreview") : t("admin.docs.noFile")}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-6 py-4">
          {file && (
            <>
              <Button variant="ghost" asChild>
                <a href={file.url} target="_blank" rel="noopener">
                  <ExportSquare /> {t("common.actions.open")}
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a href={dl}>
                  <DocumentDownload /> {t("admin.docs.download")}
                </a>
              </Button>
            </>
          )}
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
