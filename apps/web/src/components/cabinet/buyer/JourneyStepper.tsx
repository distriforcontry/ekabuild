"use client";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { CloseCircle, DocumentText, FolderOpen, Key, PenTool, TickCircle, Wallet2 } from "iconsax-reactjs";
import type { PurchaseKind, PurchaseStatus } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const POS: Record<PurchaseStatus, number> = { DRAFT: 0, PENDING_SIGNATURES: 1, SIGNED: 2, PAID: 3, COMPLETED: 4, CANCELLED: -1 };

/**
 * Compact 4-step purchase journey for cards: Shartnoma → Imzolar → To'lov → Topshirish (or Hujjatlar for packages).
 * The connecting line fills up to the current step; the current step breathes.
 */
export function JourneyStepper({ status, kind, hasContract, className }: { status: PurchaseStatus; kind: PurchaseKind; hasContract: boolean; className?: string }) {
  const { t } = useI18n();
  const pkg = kind === "DOCUMENT_PACKAGE";
  const steps: { key: string; icon: IconType }[] = [
    { key: "contract", icon: DocumentText },
    { key: "signatures", icon: PenTool },
    { key: "payment", icon: Wallet2 },
    { key: pkg ? "documents" : "handover", icon: pkg ? FolderOpen : Key },
  ];
  const cancelled = status === "CANCELLED";
  // packages are fully delivered once paid (files unlock instantly)
  let current = cancelled ? (hasContract ? 1 : 0) : POS[status];
  if (pkg && status === "PAID") current = 4;
  const fill = Math.min(1, current / (steps.length - 1));

  return (
    <ol className={cn("relative grid grid-cols-4", className)} aria-label={t("app.dashboard.journey.label")}>
      <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[15px] h-px bg-line-strong" />
      <motion.span
        aria-hidden
        className={cn("absolute left-[12.5%] top-[15px] h-px origin-left", cancelled ? "bg-danger/60" : "bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300")}
        style={{ width: "75%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: fill }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      />
      {steps.map((s, i) => {
        const done = !cancelled && i < current;
        const active = !cancelled && i === current;
        const failed = cancelled && i === current;
        const Icon = failed ? CloseCircle : done ? TickCircle : s.icon;
        return (
          <li key={s.key} className="relative flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative z-10 grid size-[30px] place-items-center rounded-full border transition-colors",
                failed
                  ? "border-danger/50 bg-ink-900 text-danger"
                  : done
                    ? "border-gold-400/70 bg-gold-gradient text-onyx shadow-[0_0_14px_-2px_rgb(201_164_100/0.55)]"
                    : active
                      ? "border-gold-400 bg-ink-900 text-gold-300"
                      : "border-line-strong bg-ink-900 text-ink-500",
              )}
            >
              {active && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full border border-gold-400/70" />}
              <Icon size={15} variant={done || active || failed ? "Bold" : "TwoTone"} />
            </motion.span>
            <span
              className={cn(
                "max-w-full truncate px-0.5 text-[10.5px] font-semibold tracking-wide sm:text-[11px]",
                failed ? "text-danger" : active ? "text-stone-100" : done ? "text-ink-200" : "text-ink-500",
              )}
            >
              {t(`app.dashboard.journey.${s.key as "contract"}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
