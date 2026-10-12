"use client";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { Award, Bag2, CloseCircle, DocumentText, PenTool, Wallet2 } from "iconsax-reactjs";
import type { PurchaseStatus } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const STEPS: { key: "created" | "contract" | "signatures" | "payment" | "completed"; icon: IconType }[] = [
  { key: "created", icon: Bag2 },
  { key: "contract", icon: DocumentText },
  { key: "signatures", icon: PenTool },
  { key: "payment", icon: Wallet2 },
  { key: "completed", icon: Award },
];

const CURRENT: Record<PurchaseStatus, number> = { DRAFT: 1, PENDING_SIGNATURES: 2, SIGNED: 3, PAID: 4, COMPLETED: 5, CANCELLED: -1 };

/** Animated lifecycle stepper: Created → Contract → Signatures → Payment → Completed. */
export function PurchaseStepper({ status, hasContract }: { status: PurchaseStatus; hasContract: boolean }) {
  const { t } = useI18n();
  const cancelled = status === "CANCELLED";
  const current = cancelled ? (hasContract ? 2 : 1) : CURRENT[status];
  const fill = Math.min(1, Math.max(0, current / (STEPS.length - 1)));

  return (
    <div className="relative">
      {/* desktop: horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute left-[10%] right-[10%] top-6 h-0.5 rounded-full bg-line-strong" />
        <motion.div
          className={cn("absolute left-[10%] top-6 h-0.5 rounded-full", cancelled ? "bg-danger/60" : "bg-gold-gradient")}
          initial={{ width: 0 }}
          animate={{ width: `${fill * 80}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        <ol className="relative grid grid-cols-5">
          {STEPS.map((s, i) => (
            <Step key={s.key} index={i} current={current} cancelled={cancelled} icon={s.icon} label={t(`app.purchases.detail.steps.${s.key}`)} />
          ))}
        </ol>
      </div>
      {/* mobile: vertical */}
      <div className="relative md:hidden">
        <div className="absolute bottom-6 left-6 top-6 w-0.5 -translate-x-1/2 rounded-full bg-line-strong" />
        <motion.div
          className={cn("absolute bottom-6 left-6 top-6 w-0.5 -translate-x-1/2 rounded-full", cancelled ? "bg-danger/60" : "bg-gold-400")}
          style={{ originY: 0 }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: fill }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
        <ol className="relative space-y-4">
          {STEPS.map((s, i) => (
            <Step key={s.key} index={i} current={current} cancelled={cancelled} icon={s.icon} label={t(`app.purchases.detail.steps.${s.key}`)} vertical />
          ))}
        </ol>
      </div>
    </div>
  );
}

function Step({
  index,
  current,
  cancelled,
  icon: Icon,
  label,
  vertical,
}: {
  index: number;
  current: number;
  cancelled: boolean;
  icon: IconType;
  label: string;
  vertical?: boolean;
}) {
  const done = index < current || current === 5;
  const active = index === current && !cancelled && current < 5;
  const failed = cancelled && index === current;
  const StepIcon = failed ? CloseCircle : Icon;
  return (
    <li className={cn("relative flex items-center gap-4", vertical ? "flex-row" : "flex-col text-center")} aria-current={active ? "step" : undefined}>
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative z-10 grid size-12 shrink-0 place-items-center rounded-2xl border transition-colors",
          failed
            ? "border-danger/50 bg-danger/10 text-danger"
            : done
              ? cancelled
                ? "border-line-strong bg-ink-800 text-ink-300"
                : "border-gold-400 bg-gold-gradient text-onyx shadow-glow"
              : active
                ? "border-gold-400 bg-ink-900 text-gold-300"
                : "border-line-strong bg-ink-900 text-ink-500",
        )}
      >
        {active && <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold-400/60" aria-hidden />}
        <StepIcon size={20} variant={done || active || failed ? "Bold" : "Linear"} />
      </motion.span>
      <span
        className={cn(
          "text-xs font-semibold md:text-[13px]",
          failed ? "text-danger" : active ? "text-stone-100" : done ? "text-ink-200" : "text-ink-500",
        )}
      >
        {label}
      </span>
    </li>
  );
}
