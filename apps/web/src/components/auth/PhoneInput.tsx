"use client";
import * as React from "react";
import { Call } from "iconsax-reactjs";
import { cn } from "@/lib/utils";
import { digitsFromE164, formatNational, nationalDigits, toE164 } from "./auth-utils";

type Props = {
  /** E.164 value, e.g. "+998901234567" (partial while typing: "+99890123") */
  value: string;
  onChange: (e164: string) => void;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  "aria-describedby"?: string;
};

/**
 * Uzbek mobile number input: fixed "+998" prefix, live mask "90 123 45 67",
 * caret-preserving editing, paste-friendly (accepts "+998 (90) 123-45-67", "998901234567", …).
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, id, name, autoFocus, disabled, invalid, placeholder = "90 123 45 67", className, onEnter, ...aria },
  ref,
) {
  const inner = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  const caret = React.useRef<number | null>(null);

  const digits = digitsFromE164(value);
  const display = formatNational(digits);

  // restore caret after the formatted value re-renders
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (el && caret.current !== null && document.activeElement === el) {
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pos = e.target.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, pos).replace(/\D/g, "").length;
    const next = nationalDigits(raw);
    // map caret: position right after the same number of digits in the formatted string
    const formatted = formatNational(next);
    let seen = 0;
    let p = 0;
    if (digitsBefore > 0) {
      for (; p < formatted.length; p++) {
        if (/\d/.test(formatted[p]!)) seen++;
        if (seen >= Math.min(digitsBefore, next.length)) {
          p++;
          break;
        }
      }
    }
    caret.current = Math.min(p, formatted.length);
    onChange(toE164(next));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const next = nationalDigits(text);
    caret.current = formatNational(next).length;
    onChange(toE164(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace right after a space removes the digit before it
    const el = e.currentTarget;
    if (e.key === "Backspace" && el.selectionStart === el.selectionEnd && el.selectionStart) {
      const pos = el.selectionStart;
      if (display[pos - 1] === " ") {
        e.preventDefault();
        const digitsBefore = display.slice(0, pos).replace(/\D/g, "").length;
        const next = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore);
        caret.current = Math.max(0, pos - 2);
        onChange(toE164(next));
      }
    }
    if (e.key === "Enter") onEnter?.();
  };

  return (
    <div
      className={cn(
        "group flex h-12 w-full items-center overflow-hidden rounded-xl border border-line bg-ink-850 transition-colors duration-200 hover:border-line-strong focus-within:border-gold-500/60 focus-within:ring-4 focus-within:ring-gold-500/10",
        invalid && "border-danger/60 hover:border-danger/60 focus-within:border-danger/60 focus-within:ring-danger/10",
        disabled && "opacity-50",
        className,
      )}
    >
      <span className="flex h-full select-none items-center gap-2 border-r border-line pl-3.5 pr-3 font-mono text-sm font-medium text-ink-200">
        <Call size={16} variant="Bulk" className="text-gold-400" />
        +998
      </span>
      <input
        ref={inner}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={aria["aria-describedby"]}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        maxLength={12}
        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[15px] tracking-wider text-stone-100 placeholder:text-ink-500 focus:outline-none"
      />
    </div>
  );
});
