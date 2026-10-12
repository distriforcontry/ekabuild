"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/**
 * Masked inputs for Uzbek business data. Each control keeps a *raw* value (digits only or a number)
 * in `value` / `onChange`, and shows a formatted string while typing. Editing works anywhere in the
 * value (the caret is kept next to the digit it was at, Backspace/Delete over a literal removes the
 * neighbouring digit), paste of any formatting works, and `aria-invalid` turns on when incomplete.
 *
 *   <MaskedInput mask="phone" value={phone} onChange={setPhone} />            // "+998901234567"
 *   <MaskedInput mask="tin" value={tin} onChange={setTin} />                  // "301234567"
 *   <MaskedInput mask="pinfl" … /> <MaskedInput mask="cadastre" … />
 *   <MoneyInput value={price} onChange={setPrice} currency="UZS" />           // number | null
 *   <NumberInput value={area} onChange={setArea} suffix="m²" decimals={1} />
 */

export type MaskKind = "phone" | "tin" | "pinfl" | "cadastre" | "passport" | "card" | "otp";

type MaskDef = {
  /** # = digit, A = letter; everything else is a literal */
  pattern: string;
  /** characters the raw value keeps */
  accept: RegExp;
  placeholder: string;
  inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** raw → value given to onChange (e.g. phone adds +998) */
  toValue?: (raw: string) => string;
  /** value → raw (inverse) */
  fromValue?: (value: string) => string;
  maxRaw: number;
};

export const MASKS: Record<MaskKind, MaskDef> = {
  phone: {
    pattern: "+998 (##) ###-##-##",
    accept: /\d/,
    placeholder: "+998 (90) 123-45-67",
    inputMode: "tel",
    maxRaw: 9,
    toValue: (raw) => (raw ? `+998${raw}` : ""),
    fromValue: (v) => v.replace(/\D/g, "").replace(/^998/, "").slice(0, 9),
  },
  tin: { pattern: "### ### ###", accept: /\d/, placeholder: "301 234 567", inputMode: "numeric", maxRaw: 9 },
  pinfl: { pattern: "# ###### ### ### #", accept: /\d/, placeholder: "3 150590 000 002 2", inputMode: "numeric", maxRaw: 14 },
  cadastre: { pattern: "##:##:##:##:##:####", accept: /\d/, placeholder: "10:05:03:02:01:0123", inputMode: "numeric", maxRaw: 14 },
  passport: { pattern: "AA #######", accept: /[A-Za-z0-9]/, placeholder: "AA 1234567", inputMode: "text", maxRaw: 9 },
  card: { pattern: "#### #### #### ####", accept: /\d/, placeholder: "8600 1234 5678 9012", inputMode: "numeric", maxRaw: 16 },
  otp: { pattern: "### ###", accept: /\d/, placeholder: "123 456", inputMode: "numeric", maxRaw: 6 },
};

export function applyMask(raw: string, pattern: string): string {
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= raw.length) break;
    if (ch === "#" || ch === "A") out += raw[i++];
    else out += ch;
  }
  return out;
}

function extractRaw(text: string, def: MaskDef, kind: MaskKind): string {
  let s = text;
  if (kind === "phone") s = s.replace(/^\+?998/, "").replace(/^\s*\(?/, "");
  const chars = [...s].filter((c) => def.accept.test(c));
  let raw = chars.join("");
  if (kind === "passport") {
    // first two letters, then digits
    const letters = raw.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
    const digits = raw.replace(/\D/g, "").slice(0, 7);
    raw = letters.length < 2 ? letters : letters + digits;
  }
  return raw.slice(0, def.maxRaw);
}

/** Index in the formatted string right after the `count`-th raw character. */
function caretForRaw(count: number, pattern: string, prefixLen: number): number {
  if (count <= 0) return prefixLen;
  let placed = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if ((ch === "#" || ch === "A") && ++placed === count) return i + 1;
  }
  return pattern.length;
}

/** Human formatting helpers (display only) */
export const formatMasked = (kind: MaskKind, value: string | null | undefined) => {
  if (!value) return "";
  const def = MASKS[kind];
  const raw = def.fromValue ? def.fromValue(value) : value.replace(/[^0-9A-Za-z]/g, "");
  return applyMask(raw, def.pattern);
};

const fieldBase =
  "h-11 w-full rounded-xl border border-line bg-ink-850 px-3.5 text-sm text-stone-100 placeholder:text-ink-400 transition-colors duration-200 hover:border-line-strong focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 disabled:opacity-50 aria-[invalid=true]:border-danger/60";

type MaskedInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> & {
  mask: MaskKind;
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** mark as invalid when the value is non-empty but incomplete (default true) */
  validateComplete?: boolean;
};

export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, className, validateComplete = true, onBlur, ...rest }, ref) => {
    const def = MASKS[mask];
    const raw = def.fromValue ? def.fromValue(value ?? "") : (value ?? "");
    const [touched, setTouched] = React.useState(false);
    const display = applyMask(raw, def.pattern);
    const incomplete = raw.length > 0 && raw.length < def.maxRaw;

    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode={def.inputMode}
        autoComplete={mask === "phone" ? "tel" : mask === "otp" ? "one-time-code" : "off"}
        spellCheck={false}
        placeholder={def.placeholder}
        className={cn(fieldBase, "font-mono tracking-wide", className)}
        value={mask === "phone" && !raw ? "" : display}
        aria-invalid={(validateComplete && touched && incomplete) || rest["aria-invalid"] ? true : undefined}
        onFocus={(e) => {
          if (mask === "phone" && !raw) e.currentTarget.placeholder = "+998 (__) ___-__-__";
          rest.onFocus?.(e);
        }}
        onChange={(e) => {
          const el = e.target;
          const text = el.value;
          const caret = el.selectionStart ?? text.length;
          let next = extractRaw(text, def, mask);
          // how many raw characters sit before the caret (the "+998 (" prefix of a phone is not raw)
          const prefixLen = mask === "phone" ? 6 : 0;
          let rawCaret = mask === "phone" && text.startsWith("+998") && caret <= prefixLen ? 0 : extractRaw(text.slice(0, caret), def, mask).length;
          const inputType = (e.nativeEvent as InputEvent).inputType ?? "";
          if (inputType.startsWith("delete") && next === raw) {
            // only a literal ("-", ")", " ") was removed: delete the neighbouring digit instead
            if (inputType === "deleteContentForward") next = raw.slice(0, rawCaret) + raw.slice(rawCaret + 1);
            else if (rawCaret > 0) {
              next = raw.slice(0, rawCaret - 1) + raw.slice(rawCaret);
              rawCaret -= 1;
            }
          }
          rawCaret = Math.min(rawCaret, next.length);
          onChange(def.toValue ? def.toValue(next) : next);
          // restore the caret after React re-renders the formatted value (mid-string edits stay in place)
          const pos = caretForRaw(rawCaret, def.pattern, next.length ? prefixLen : 0);
          requestAnimationFrame(() => {
            if (document.activeElement === el) el.setSelectionRange(pos, pos);
          });
        }}
        onBlur={(e) => {
          setTouched(true);
          if (mask === "phone") e.currentTarget.placeholder = def.placeholder;
          onBlur?.(e);
        }}
      />
    );
  },
);
MaskedInput.displayName = "MaskedInput";

// ───────────────────────────── numbers & money ─────────────────────────────

const groupDigits = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function formatNumber(n: number | null | undefined, decimals: number) {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  const [i, d] = n.toFixed(decimals).split(".");
  return d && Number(d) !== 0 ? `${groupDigits(i!)},${d.replace(/0+$/, "")}` : groupDigits(i!);
}

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  decimals?: number;
  min?: number;
  max?: number;
  /** unit shown inside the field on the right (m², qavat, %, so'm…) */
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
};

/** Numeric field with live thousands grouping ("1 250 000"), comma or dot decimals, optional unit. */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, decimals = 0, min, max, suffix, prefix, className, onBlur, ...rest }, ref) => {
    const [text, setText] = React.useState(() => formatNumber(value, decimals));
    const focused = React.useRef(false);

    React.useEffect(() => {
      if (!focused.current) setText(formatNumber(value, decimals));
    }, [value, decimals]);

    const parse = (s: string): number | null => {
      const cleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };

    return (
      <div className={cn("relative", className)}>
        {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-400">{prefix}</span>}
        <input
          {...rest}
          ref={ref}
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          className={cn(fieldBase, "font-mono", prefix && "pl-9", suffix && "pr-16")}
          value={text}
          onFocus={(e) => {
            focused.current = true;
            rest.onFocus?.(e);
          }}
          onChange={(e) => {
            let s = e.target.value.replace(/[^\d\s.,]/g, "");
            const [intPart, ...dec] = s.replace(/\s/g, "").split(/[.,]/);
            const decPart = decimals ? dec.join("").slice(0, decimals) : "";
            s = groupDigits(intPart ?? "") + (decimals && /[.,]/.test(e.target.value) ? `,${decPart}` : "");
            setText(s);
            onChange(parse(s));
          }}
          onBlur={(e) => {
            focused.current = false;
            let n = parse(text);
            if (n !== null) {
              if (min !== undefined) n = Math.max(min, n);
              if (max !== undefined) n = Math.min(max, n);
              onChange(n);
            }
            setText(formatNumber(n, decimals));
            onBlur?.(e);
          }}
        />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">{suffix}</span>}
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";

/** Money field: integer so'm (or other currency) with grouping and a short-scale hint ("845 mln so'm"). */
export function MoneyInput({
  value,
  onChange,
  currency = "UZS",
  hint = true,
  className,
  ...rest
}: Omit<NumberInputProps, "suffix" | "decimals"> & { currency?: string; hint?: boolean }) {
  const { t, locale } = useI18n();
  const unit = currency === "UZS" ? t("catalog.money.currency") : currency;
  const dec = (n: number, digits: number) => n.toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ", { maximumFractionDigits: digits });
  const short =
    value && value >= 1e9 ? `${dec(value / 1e9, 2)} ${t("catalog.money.mlrd")}` : value && value >= 1e6 ? `${dec(value / 1e6, 1)} ${t("catalog.money.mln")}` : null;
  return (
    <div className={className}>
      <NumberInput value={value} onChange={onChange} decimals={0} min={0} suffix={unit} {...rest} />
      {hint && short && (
        <div className="mt-1 text-[11px] text-ink-400">
          ≈ {short} {unit}
        </div>
      )}
    </div>
  );
}
