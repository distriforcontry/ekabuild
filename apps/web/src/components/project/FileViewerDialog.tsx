"use client";
import * as React from "react";
import { DocumentDownload, ExportSquare } from "iconsax-reactjs";
import type { FileRef } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { BuildingViewer } from "@/components/three/BuildingViewer";
import { useFormat } from "@/components/catalog/use-format";
import { isImage, isModel, isPdf } from "@/components/catalog/format";
import { ZoomPanViewer } from "./ZoomPanViewer";
import { ShaChip, downloadUrl, fileIcon } from "./bits";

/** Opens a document file: images → pan/zoom viewer, PDFs → iframe, GLB/GLTF → 3D viewer, others → download. */
export function FileViewerDialog({
  file,
  title,
  open,
  onOpenChange,
}: {
  file: FileRef | null;
  title: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  if (!file) return null;
  const I = fileIcon(file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4 pr-14">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/8 text-gold-300">
            <I size={19} variant="Bulk" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="truncate">{file.originalName}</span>
              <span className="font-mono text-ink-400">{fmt.bytes(file.size)}</span>
            </DialogDescription>
          </div>
          <ShaChip sha={file.sha256} className="hidden md:inline-flex" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                <ExportSquare size={15} />
                <span className="hidden sm:inline">{t("catalog.zoom.openNew")}</span>
              </a>
            </Button>
            <Button variant="gold" size="sm" asChild>
              <a href={downloadUrl(file)}>
                <DocumentDownload size={15} />
                {t("catalog.file.download")}
              </a>
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-3 md:p-4">
          {isImage(file.mime, file.originalName) ? (
            <ZoomPanViewer src={file.url} alt={title} />
          ) : isPdf(file.mime, file.originalName) ? (
            <iframe src={`${file.url}#view=FitH`} title={title} className="size-full rounded-2xl border border-line bg-ink-850" />
          ) : isModel(file.mime, file.originalName) ? (
            <BuildingViewer model3d={file} name={title} className="h-full rounded-2xl" />
          ) : (
            <EmptyState
              icon={I}
              title={file.originalName}
              description={fmt.bytes(file.size)}
              className="h-full"
              action={
                <Button variant="gold" asChild>
                  <a href={downloadUrl(file)}>
                    <DocumentDownload size={16} />
                    {t("catalog.file.download")}
                  </a>
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
