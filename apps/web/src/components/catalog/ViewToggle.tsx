"use client";
import { motion } from "motion/react";
import { Element3, Map1, RowVertical } from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./filters";

const ITEMS: { value: ViewMode; icon: Icon }[] = [
  { value: "grid", icon: Element3 },
  { value: "list", icon: RowVertical },
  { value: "map", icon: Map1 },
];

/** Segmented Grid / List / Map switch with a sliding gold pill. */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("catalog.view.label")} className="inline-flex rounded-xl border border-line bg-ink-900 p-1">
      {ITEMS.map(({ value: v, icon: I }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "text-onyx" : "text-ink-300 hover:text-stone-100",
            )}
          >
            {active && (
              <motion.span
                layoutId="catalog-view-pill"
                className="absolute inset-0 rounded-lg bg-gold-gradient shadow-glow"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <I size={17} variant={active ? "Bold" : "Linear"} className="relative" />
            <span className="relative hidden sm:inline">{t(`catalog.view.${v}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
