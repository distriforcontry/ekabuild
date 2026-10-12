"use client";
// Small presentational helpers shared by the project detail tabs.
import * as React from "react";
import { toast } from "sonner";
import { Copy, DocumentDownload, DocumentText, Gallery, I3DCubeScan, TickCircle } from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import type { FileRef } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { useFormat } from "@/components/catalog/use-format";
import { isImage, isModel, isPdf, shortHash } from "@/components/catalog/format";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({
  value,
  label,
  toastText,
  className,
  size = 14,
}: {
  value: string;
  label?: string;
  toastText?: string;
  className?: string;
  size?: number;
}) {
  const { t } = useI18n();
  const [done, setDone] = React.useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyText(value)) {
      setDone(true);
      toast.success(toastText ?? t("catalog.file.copied"));
      setTimeout(() => setDone(false), 1600);
    }
  };
  const l = label ?? t("catalog.file.copy");
  return (
    <Tooltip content={done ? t("catalog.file.copied") : l}>
      <button
        type="button"
        onClick={onClick}
        aria-label={l}
        className={cn(
          "inline-grid cursor-pointer place-items-center rounded-md p-1 text-ink-400 transition hover:bg-fg/5 hover:text-gold-300",
          done && "text-success hover:text-success",
          className,
        )}
      >
        {done ? <TickCircle size={size} variant="Bold" /> : <Copy size={size} />}
      </button>
    </Tooltip>
  );
}

/** "SHA-256 3fa2…91bd [copy]" */
export function ShaChip({ sha, className }: { sha: string; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-850 py-0.5 pl-2 pr-0.5 text-[11px]", className)}>
      <span className="font-semibold text-ink-400">{t("catalog.file.sha")}</span>
      <span className="font-mono text-ink-200" title={sha}>
        {shortHash(sha, 8)}
      </span>
      <CopyButton value={sha} label={t("catalog.file.copySha")} toastText={t("catalog.file.shaCopied")} size={13} />
    </span>
  );
}

export function fileIcon(f: Pick<FileRef, "mime" | "originalName">): Icon {
  if (isImage(f.mime, f.originalName)) return Gallery;
  if (isModel(f.mime, f.originalName)) return I3DCubeScan;
  return DocumentText;
}

export function fileKindLabel(f: Pick<FileRef, "mime" | "originalName">, t: ReturnType<typeof useI18n>["t"]) {
  if (isImage(f.mime, f.originalName)) return t("catalog.file.image");
  if (isPdf(f.mime, f.originalName)) return t("catalog.file.pdf");
  if (isModel(f.mime, f.originalName)) return t("catalog.file.model");
  return t("catalog.file.file");
}

export const downloadUrl = (f: Pick<FileRef, "url">) => `${f.url}${f.url.includes("?") ? "&" : "?"}download=1`;

/** Compact downloadable file pill (non-image attachments). */
export function FileChip({ file, className }: { file: FileRef; className?: string }) {
  const fmt = useFormat();
  const { t } = useI18n();
  const I = fileIcon(file);
  return (
    <a
      href={downloadUrl(file)}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-ink-850 px-3 py-2 text-xs transition hover:border-gold-500/40 hover:bg-gold-500/5",
        className,
      )}
      aria-label={`${t("catalog.file.download")}: ${file.originalName}`}
    >
      <I size={16} variant="Bulk" className="shrink-0 text-gold-300" />
      <span className="min-w-0 truncate text-ink-100">{file.originalName}</span>
      <span className="shrink-0 font-mono text-ink-400">{fmt.bytes(file.size)}</span>
      <DocumentDownload size={15} variant="Bulk" className="shrink-0 text-gold-500 transition group-hover:text-gold-300" />
    </a>
  );
}

/** Card section with icon + title + optional action. */
export function Section({
  icon: I,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon?: Icon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-line bg-ink-900/80 shadow-card backdrop-blur-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 md:px-7 md:pt-6">
        <div className="flex items-start gap-3">
          {I && (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/8 text-gold-300">
              <I size={19} variant="Bulk" />
            </span>
          )}
          <div>
            <h3 className="text-base font-semibold tracking-tight text-stone-100 md:text-lg">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-ink-400">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn("px-5 pb-5 pt-5 md:px-7 md:pb-7", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Image tile that degrades to an icon tile when the image fails (API down). */
export function Thumb({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [failed, setFailed] = React.useState(false);
  const inner = failed ? (
    <span className="bg-blueprint grid size-full place-items-center bg-ink-850 text-ink-400">
      <Gallery size={20} variant="Bulk" />
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
  );
  if (!onClick) return <span className={cn("group block overflow-hidden", className)}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={alt} className={cn("group block cursor-zoom-in overflow-hidden focus-visible:ring-2 focus-visible:ring-gold-400", className)}>
      {inner}
    </button>
  );
}
