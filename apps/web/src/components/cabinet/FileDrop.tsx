"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseCircle, DocumentUpload, Danger, TickCircle } from "iconsax-reactjs";
import { formatBytes } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { uploadFile, errorMessage, type UploadedFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FileTypeIcon } from "./FileTypeIcon";

const MAX_BYTES = 200 * 1024 * 1024;

/** Drag & drop zone (keyboard accessible, click to browse). */
export function FileDrop({
  onFiles,
  accept,
  multiple,
  types,
  maxBytes = MAX_BYTES,
  disabled,
  compact,
  className,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** human list shown in the hint, e.g. "PDF, JPG, PNG" */
  types?: string;
  maxBytes?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const extOk = (f: File) => {
    if (!accept) return true;
    const list = accept.split(",").map((s) => s.trim().toLowerCase());
    const name = f.name.toLowerCase();
    return list.some((a) => (a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a));
  };

  const take = (list: FileList | null) => {
    if (!list?.length) return;
    let files = Array.from(list);
    if (!multiple) files = files.slice(0, 1);
    const bad = files.find((f) => !extOk(f));
    const big = files.find((f) => f.size > maxBytes);
    setError(bad ? t("app.upload.badType") : big ? t("app.upload.tooBig") : null);
    files = files.filter((f) => extOk(f) && f.size <= maxBytes);
    if (files.length) onFiles(files);
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition-all duration-300",
          compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-9",
          over ? "scale-[1.01] border-gold-400 bg-gold-500/[0.08]" : "border-line-strong bg-ink-850/50 hover:border-gold-500/50 hover:bg-gold-500/[0.03]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-60" />
        <motion.span
          animate={over ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
          className={cn(
            "relative grid place-items-center rounded-2xl border transition-colors",
            compact ? "size-10" : "size-14",
            over ? "border-gold-400 bg-gold-gradient text-onyx" : "border-gold-500/25 bg-gold-500/10 text-gold-300",
          )}
        >
          <DocumentUpload size={compact ? 18 : 24} variant="Bulk" />
        </motion.span>
        <div className="relative">
          <div className="text-sm font-semibold text-stone-100">{multiple ? t("app.upload.dropMany") : t("app.upload.drop")}</div>
          <div className="mt-0.5 text-xs text-gold-300 underline-offset-4 group-hover:underline">{t("app.upload.browse")}</div>
          {types && <div className="mt-1.5 text-[11px] text-ink-400">{t("app.upload.hint", { types, size: formatBytes(maxBytes) })}</div>}
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

// ───────────── upload queue ─────────────

export type UploadItem = {
  key: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  result?: UploadedFile;
  error?: string;
};

/** Upload queue with per-file progress. */
export function useUploads() {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const patch = (key: string, p: Partial<UploadItem>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const add = React.useCallback((files: File[], replace = false): Promise<(UploadedFile | null)[]> => {
    const fresh = files.map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, progress: 0, status: "uploading" as const }));
    setItems((prev) => (replace ? fresh : [...prev, ...fresh]));
    return Promise.all(
      fresh.map(async (it) => {
        try {
          const res = await uploadFile(it.file, (p) => patch(it.key, { progress: p }));
          patch(it.key, { status: "done", progress: 1, result: res });
          return res;
        } catch (e) {
          patch(it.key, { status: "error", error: errorMessage(e) });
          return null;
        }
      }),
    );
  }, []);

  const remove = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const reset = () => setItems([]);
  const busy = items.some((i) => i.status === "uploading");
  const done = items.filter((i) => i.status === "done" && i.result).map((i) => i.result!);
  return { items, add, remove, reset, busy, done };
}

/** Animated list of queued uploads with progress bars. */
export function UploadList({ items, onRemove, className }: { items: UploadItem[]; onRemove?: (key: string) => void; className?: string }) {
  const { t } = useI18n();
  return (
    <ul className={cn("space-y-2", className)}>
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.li
            key={it.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-xl border border-line bg-ink-850 px-3 py-2.5"
          >
            <FileTypeIcon mime={it.file.type} name={it.file.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-stone-100">{it.file.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-400">{formatBytes(it.file.size)}</span>
              </div>
              {it.status === "uploading" ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-fg/10">
                    <motion.div className="h-full rounded-full bg-gold-gradient" animate={{ width: `${Math.round(it.progress * 100)}%` }} transition={{ ease: "easeOut" }} />
                  </div>
                  <span className="font-mono text-[10px] text-ink-400">{Math.round(it.progress * 100)}%</span>
                </div>
              ) : it.status === "done" ? (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-success">
                  <TickCircle size={12} variant="Bold" /> {t("app.upload.done")}
                  {it.result?.sha256 && <span className="ml-1 font-mono text-ink-400">· {it.result.sha256.slice(0, 12)}…</span>}
                </div>
              ) : (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-danger">
                  <Danger size={12} variant="Bold" /> {t("app.upload.failed")}
                  {it.error ? ` · ${it.error}` : ""}
                </div>
              )}
            </div>
            {onRemove && it.status !== "uploading" && (
              <button
                type="button"
                onClick={() => onRemove(it.key)}
                aria-label={t("app.upload.remove")}
                className="grid size-7 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:bg-fg/5 hover:text-danger"
              >
                <CloseCircle size={16} />
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
