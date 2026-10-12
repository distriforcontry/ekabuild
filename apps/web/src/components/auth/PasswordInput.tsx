"use client";
import * as React from "react";
import { motion } from "motion/react";
import { Eye, EyeSlash, Lock1, TickCircle } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { passwordChecks, passwordScore } from "./auth-utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean };

/** Password field with a lock icon and a show/hide toggle. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(function PasswordInput({ className, invalid, ...props }, ref) {
  const { t } = useI18n();
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Lock1 size={18} variant="Bulk" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-xl border border-line bg-ink-850 pl-11 pr-12 text-[15px] text-stone-100 placeholder:text-ink-500 transition-colors duration-200 hover:border-line-strong focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 disabled:opacity-50",
          invalid && "border-danger/60 hover:border-danger/60 focus:border-danger/60 focus:ring-danger/10",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.password.hide") : t("auth.password.show")}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:bg-fg/5 hover:text-stone-100"
      >
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
});

const LEVELS = [
  { key: "empty", bar: "bg-fg/10", text: "text-ink-400" },
  { key: "weak", bar: "bg-danger", text: "text-danger" },
  { key: "fair", bar: "bg-warning", text: "text-warning" },
  { key: "good", bar: "bg-info", text: "text-info" },
  { key: "strong", bar: "bg-success", text: "text-success" },
] as const;

/** 4-segment strength meter + requirement checklist. */
export function PasswordStrength({ password, showRules = true }: { password: string; showRules?: boolean }) {
  const { t } = useI18n();
  const score = passwordScore(password);
  const level = LEVELS[score];
  const checks = passwordChecks(password);
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-1.5 overflow-hidden rounded-full bg-fg/8">
              <motion.div
                className={cn("h-full rounded-full", level.bar)}
                initial={false}
                animate={{ width: score >= i ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: (i - 1) * 0.04 }}
              />
            </div>
          ))}
        </div>
        <span className={cn("min-w-16 text-right text-xs font-semibold", level.text)}>{t(`auth.password.strength.${level.key}`)}</span>
      </div>
      {showRules && (
        <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {(Object.keys(checks) as (keyof typeof checks)[]).map((k) => (
            <li key={k} className={cn("flex items-center gap-1.5 text-xs transition-colors", checks[k] ? "text-success" : "text-ink-400")}>
              <TickCircle size={14} variant={checks[k] ? "Bold" : "Linear"} />
              {t(`auth.password.rules.${k}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
