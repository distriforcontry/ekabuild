"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Titled block inside editor forms. */
export function FormSection({
  title,
  description,
  children,
  className,
  aside,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-ink-900 p-5 shadow-card md:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-stone-100">{title}</h3>
          {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Range slider styled for the brand (keyboard accessible native input). */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  id,
  suffix = "%",
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  suffix?: string;
  "aria-label"?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-11 flex-1 items-center">
        <div className="absolute inset-x-0 h-2 rounded-full bg-fg/10" />
        <div className="absolute left-0 h-2 rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-10 h-11 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold-300 [&::-moz-range-thumb]:bg-ink-950 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-300 [&::-webkit-slider-thumb]:bg-ink-950 [&::-webkit-slider-thumb]:shadow-glow"
        />
      </div>
      <span className="w-14 rounded-lg border border-line bg-ink-850 py-1.5 text-center font-mono text-sm text-stone-100">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/** Parses a user-typed number ("1 250 000,5" → 1250000.5); empty → null; invalid → NaN */
export function parseNum(v: string): number | null {
  const s = v.replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export const toDateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
export const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
