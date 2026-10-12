"use client";
import * as React from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** fired once all boxes are filled */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  /** bump this number to play the error shake */
  errorKey?: number;
  invalid?: boolean;
  autoFocus?: boolean;
};

/**
 * 6-box one-time-code input: auto-advance, backspace to previous, arrow keys, paste of the full code,
 * `autoComplete="one-time-code"` (iOS / Android SMS autofill) and an error shake.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled, errorKey = 0, invalid, autoFocus = true }: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  React.useEffect(() => {
    if (autoFocus) focus(Math.min(value.length, length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  // after an error: shake, then jump back to the first box
  React.useEffect(() => {
    if (errorKey <= 0) return;
    if (!reduce && scope.current) animate(scope.current, { x: [0, -10, 10, -8, 8, -4, 4, 0] }, { duration: 0.5 });
    focus(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKey]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const setAt = (i: number, input: string) => {
    const digits = input.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      // autofill or paste into a box: spread from this position (or from the start for a full code)
      const start = digits.length >= length ? 0 : i;
      const arr = chars.slice();
      for (let k = 0; k < digits.length && start + k < length; k++) arr[start + k] = digits[k]!;
      const joined = arr.join("").slice(0, length);
      commit(joined);
      focus(Math.min(length - 1, start + digits.length));
      return;
    }
    const arr = chars.slice();
    arr[i] = digits;
    // keep the value contiguous
    const joined = arr.join("");
    commit(joined);
    if (i < length - 1) focus(i + 1);
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = chars.slice();
      if (arr[i]) {
        arr[i] = "";
        onChange(arr.join("").slice(0, i) + arr.slice(i + 1).join(""));
      } else if (i > 0) {
        arr[i - 1] = "";
        onChange(arr.slice(0, i - 1).join("") + arr.slice(i).join(""));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    } else if (e.key === "Delete") {
      e.preventDefault();
      const arr = chars.slice();
      arr[i] = "";
      onChange(arr.join(""));
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    commit(text);
    focus(Math.min(length - 1, text.length));
  };

  return (
    <div ref={scope} role="group" aria-label={t("auth.otp.label")} className="flex items-center justify-between gap-2 sm:gap-3">
      {chars.map((c, i) => (
        <React.Fragment key={i}>
          {i === length / 2 && <span className="hidden h-px w-3 shrink-0 bg-line-strong sm:block" aria-hidden />}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={t("auth.otp.digit", { n: i + 1 })}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={c}
            maxLength={length}
            onFocus={(e) => {
              // keep the code contiguous: never start typing past the first empty box
              if (i > value.length) focus(value.length);
              else e.currentTarget.select();
            }}
            onChange={(e) => setAt(i, e.target.value.replace(c, "") || e.target.value)}
            onKeyDown={onKeyDown(i)}
            onPaste={onPaste}
            className={cn(
              "h-14 w-full min-w-0 max-w-14 rounded-xl border bg-ink-850 text-center font-mono text-2xl font-semibold text-stone-100 caret-gold-400 transition-all duration-200 focus:outline-none sm:h-16 sm:text-[26px]",
              c ? "border-gold-500/50 bg-gold-500/[0.06]" : "border-line hover:border-line-strong",
              "focus:border-gold-400 focus:ring-4 focus:ring-gold-500/15",
              invalid && "border-danger/60 bg-danger/5 focus:border-danger focus:ring-danger/10",
              disabled && "opacity-60",
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
