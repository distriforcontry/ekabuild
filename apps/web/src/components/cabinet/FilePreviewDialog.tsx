"use client";
import { DocumentDownload } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import type { FileRef } from "@/lib/types";
import { fileKind, FileTypeIcon } from "./FileTypeIcon";
import { useFmt } from "./format";

export const downloadUrl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}download=1`;

/** In-app preview for images and PDFs; other types offer a download. */
export function FilePreviewDialog({ file, title, open, onOpenChange }: { file: FileRef | null; title?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const kind = file ? fileKind(file.mime, file.originalName) : "other";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex max-h-[92vh] flex-col overflow-hidden">
        {file && (
          <>
            <DialogHeader className="flex items-center gap-3">
              <FileTypeIcon mime={file.mime} name={file.originalName} size="sm" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base">{title ?? file.originalName}</DialogTitle>
                <DialogDescription className="truncate font-mono text-xs">
                  {file.originalName} · {fmt.bytes(file.size)}
                </DialogDescription>
              </div>
              <Button asChild size="sm" variant="secondary" className="mr-8">
                <a href={downloadUrl(file.url)} download>
                  <DocumentDownload size={16} /> <span className="hidden sm:inline">{t("app.common.download")}</span>
                </a>
              </Button>
            </DialogHeader>
            <div className="min-h-0 flex-1 bg-ink-950">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={title ?? file.originalName} className="mx-auto block max-h-[75vh] w-auto object-contain" />
              ) : kind === "pdf" ? (
                <iframe src={file.url} title={title ?? file.originalName} className="h-[75vh] w-full border-0" />
              ) : kind === "video" ? (
                <video src={file.url} controls className="mx-auto max-h-[75vh] w-full" />
              ) : (
                <div className="grid h-64 place-items-center px-6 text-center text-sm text-ink-400">{t("app.files.previewUnavailable")}</div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
