"use client";
// Compact, dense controls for the studio panels (pro-tool density, both themes).
import * as React from "react";
import { ArrowDown2 } from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { AnimatePresence, motion } from "motion/react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-ink-850 px-1.5 font-mono text-[10px] font-semibold text-ink-200 shadow-[inset_0_-1px_0_var(--color-line-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function TipLabel({ label, kbd }: { label: string; kbd?: string }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      {kbd && <Kbd>{kbd}</Kbd>}
    </span>
  );
}

export const IconBtn = React.forwardRef<
  HTMLButtonElement,
  {
    icon: Icon;
    label: string;
    kbd?: string;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    side?: "top" | "bottom" | "left" | "right";
    size?: "sm" | "md";
    className?: string;
    tone?: "default" | "danger";
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">
>(({ icon: I, label, kbd, active, disabled, onClick, side = "bottom", size = "md", className, tone = "default", ...rest }, ref) => (
  <Tooltip content={<TipLabel label={label} kbd={kbd} />} side={side}>
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      {...rest}
      className={cn(
        "relative grid shrink-0 cursor-pointer place-items-center rounded-lg transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        size === "md" ? "size-9" : "size-7",
        active
          ? "bg-gold-500/15 text-gold-200 shadow-[inset_0_0_0_1px_rgb(201_164_100/0.45)]"
          : tone === "danger"
            ? "text-ink-300 hover:bg-danger/10 hover:text-danger"
            : "text-ink-200 hover:bg-fg/6 hover:text-stone-100",
        className,
      )}
    >
      <I size={size === "md" ? 18 : 15} variant={active ? "Bold" : "Linear"} />
    </button>
  </Tooltip>
));
IconBtn.displayName = "IconBtn";

export function Divider({ vertical = true, className }: { vertical?: boolean; className?: string }) {
  return <span aria-hidden className={cn(vertical ? "mx-1 h-6 w-px" : "my-1 h-px w-full", "shrink-0 bg-line", className)} />;
}

export function Section({
  title,
  icon: I,
  action,
  children,
  defaultOpen = true,
  className,
}: {
  title: string;
  icon?: Icon;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <section className={cn("border-b border-line last:border-b-0", className)}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300 transition hover:text-stone-100"
        >
          <ArrowDown2 size={12} className={cn("shrink-0 transition-transform duration-200", !open && "-rotate-90")} />
          {I && <I size={14} className="shrink-0 text-gold-400" />}
          <span className="truncate">{title}</span>
        </button>
        {action}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Row({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-3 text-xs", className)}>
      <span className="min-w-0 truncate text-ink-300">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-[11.5px] text-stone-100">{children}</span>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex min-h-8 cursor-pointer items-center justify-between gap-3 text-xs", disabled && "pointer-events-none opacity-50")}>
      <span className="min-w-0">
        <span className="block truncate text-ink-200">{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200",
          checked ? "border-gold-500/60 bg-gold-500/80" : "border-line-strong bg-ink-800",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full shadow transition-all duration-200",
            checked ? "left-[18px] bg-onyx" : "left-0.5 bg-ink-300",
          )}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  disabled,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className={cn("block py-1 text-xs", disabled && "pointer-events-none opacity-50")}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-ink-200">{label}</span>
        <span className="font-mono text-[11px] text-gold-200">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-700 outline-none",
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-400 [&::-webkit-slider-thumb]:bg-ink-900 [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold-400 [&::-moz-range-thumb]:bg-ink-900",
          "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-gold-500/25",
        )}
        style={{ background: `linear-gradient(90deg, var(--color-gold-500) ${pct}%, var(--color-ink-700) ${pct}%)` }}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex rounded-lg border border-line bg-ink-850 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 font-semibold transition-all",
            size === "md" ? "h-7 text-xs" : "h-6 text-[11px]",
            value === o.value ? "bg-ink-700 text-stone-100 shadow-card" : "text-ink-300 hover:text-stone-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric field with negative values, arrow-key nudging and drag-to-scrub on the axis badge. */
export function NumField({
  value,
  onCommit,
  axis,
  step = 0.1,
  decimals = 2,
  suffix,
  disabled,
  ariaLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  axis?: "x" | "y" | "z" | string;
  step?: number;
  decimals?: number;
  suffix?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = React.useState(() => value.toFixed(decimals));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(Number.isFinite(value) ? value.toFixed(decimals) : "0");
  }, [value, decimals]);
  const commit = (s: string) => {
    const n = Number(s.replace(",", ".").replace(/\s/g, ""));
    if (Number.isFinite(n)) onCommit(n);
    else setText(value.toFixed(decimals));
  };
  const scrub = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = value;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const k = ev.shiftKey ? 0.1 : ev.altKey ? 10 : 1;
      const next = start + Math.round((ev.clientX - startX) / 2) * step * k;
      onCommit(Number(next.toFixed(decimals)));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const tone = axis === "x" ? "text-danger" : axis === "y" ? "text-success" : axis === "z" ? "text-info" : "text-ink-400";
  return (
    <div
      className={cn(
        "group/num flex h-8 min-w-0 items-center rounded-lg border border-line bg-ink-850 transition-colors focus-within:border-gold-500/60 focus-within:ring-2 focus-within:ring-gold-500/15 hover:border-line-strong",
        disabled && "opacity-50",
      )}
    >
      {axis && (
        <span
          onPointerDown={scrub}
          className={cn("flex h-full cursor-ew-resize select-none items-center pl-2 pr-1 font-mono text-[10px] font-bold uppercase", tone)}
          aria-hidden
        >
          {axis}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.currentTarget.value);
        }}
        onChange={(e) => setText(e.target.value.replace(/[^\d.,\-\s]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setText(value.toFixed(decimals));
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const k = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            const n = Number((value + step * k).toFixed(decimals));
            setText(n.toFixed(decimals));
            onCommit(n);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-1.5 font-mono text-[11.5px] text-stone-100 outline-none"
      />
      {suffix && <span className="pr-2 font-mono text-[10px] text-ink-400">{suffix}</span>}
    </div>
  );
}

export function ColorField({
  value,
  onChange,
  onCommit,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  label: string;
}) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span className="min-w-0 flex-1 truncate text-ink-200">{label}</span>
      <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong shadow-card" style={{ background: value }}>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <input
        type="text"
        aria-label={`${label} HEX`}
        value={text}
        maxLength={7}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (/^#[0-9a-f]{6}$/i.test(text) ? onChange(text.toLowerCase()) : setText(value))}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="h-7 w-[76px] rounded-lg border border-line bg-ink-850 px-2 font-mono text-[11px] uppercase text-stone-100 outline-none focus:border-gold-500/60"
      />
    </div>
  );
}

export function MiniStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink-850/60 px-3 py-2.5">
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-400" title={label}>
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[15px] font-semibold text-stone-100">{value}</div>
      {sub && <div className="truncate text-[10.5px] text-ink-400">{sub}</div>}
    </div>
  );
}

export function PanelEmpty({ icon: I, title, hint, action }: { icon: Icon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-300">
        <I size={22} variant="Bulk" />
      </div>
      <div className="text-sm font-semibold text-stone-100">{title}</div>
      {hint && <p className="mt-1 max-w-64 text-xs leading-relaxed text-ink-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
