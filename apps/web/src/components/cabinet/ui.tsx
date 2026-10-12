"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowLeft, Buildings, Copy, TickCircle } from "iconsax-reactjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { copyText } from "./hooks";

/** Icon button that copies text and morphs into a tick. */
export function CopyButton({ text, label, toastText, className }: { text: string; label?: string; toastText?: string; className?: string }) {
  const { t } = useI18n();
  const [done, setDone] = React.useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyText(text)) {
      setDone(true);
      if (toastText) toast.success(toastText);
      setTimeout(() => setDone(false), 1600);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? t("app.common.copy")}
      title={label ?? t("app.common.copy")}
      className={cn(
        "relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:bg-fg/5 hover:text-stone-100",
        done && "text-success hover:text-success",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? "ok" : "copy"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
          {done ? <TickCircle size={16} variant="Bold" /> : <Copy size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** Generic confirm dialog with async confirm handler. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "gold",
  icon: Icon,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: "gold" | "danger";
  icon?: IconType;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {Icon && (
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl border",
                  tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : "border-gold-500/30 bg-gold-500/10 text-gold-300",
                )}
              >
                <Icon size={20} variant="Bulk" />
              </span>
            )}
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        {children && <DialogBody>{children}</DialogBody>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.actions.cancel")}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "gold"} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Project cover image with an elegant blueprint placeholder. */
export function ProjectCover({ src, alt, className, iconSize = 28 }: { src?: string | null; alt: string; className?: string; iconSize?: number }) {
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("size-full object-cover", className)} />
    );
  }
  return (
    <div className={cn("relative grid size-full place-items-center overflow-hidden bg-ink-850", className)} aria-label={alt} role="img">
      <div className="bg-blueprint absolute inset-0 opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gold-500/10 to-transparent" />
      <Buildings size={iconSize} variant="Bulk" className="relative text-gold-400/70" />
    </div>
  );
}

/** "← Back" link above detail pages */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="group mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-300 transition hover:text-stone-100">
      <span className="grid size-7 place-items-center rounded-lg border border-line transition group-hover:-translate-x-0.5 group-hover:border-line-strong">
        <ArrowLeft size={14} />
      </span>
      {label}
    </Link>
  );
}

/** Truncated monospace hash with copy */
export function HashChip({ value, className, chars = 10 }: { value: string; className?: string; chars?: number }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-850 py-0.5 pl-2 pr-0.5", className)}>
      <span className="font-mono text-[11px] text-ink-300" title={value}>
        {value.slice(0, chars)}…{value.slice(-4)}
      </span>
      <CopyButton text={value} className="size-6" toastText={t("app.files.hashCopied")} />
    </span>
  );
}

/** Underlined key–value list (compact) */
export function KV({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start justify-between gap-6 py-2.5">
          <dt className="text-sm text-ink-400">{it.label}</dt>
          <dd className={cn("text-right text-sm text-stone-100", it.mono && "font-mono")}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
