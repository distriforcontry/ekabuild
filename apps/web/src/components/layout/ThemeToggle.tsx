"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun1 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Animated sun/moon switch between the two themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={`${t("common.theme.label")}: ${dark ? t("common.theme.dark") : t("common.theme.light")}`}
      title={dark ? t("common.theme.light") : t("common.theme.dark")}
      className={cn(
        "relative grid size-10 cursor-pointer place-items-center overflow-hidden rounded-xl border border-line text-ink-200 transition hover:border-line-strong hover:bg-fg/5 hover:text-stone-100",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ y: 18, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -18, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid place-items-center"
        >
          {dark ? <Moon size={18} variant="Bulk" /> : <Sun1 size={18} variant="Bulk" className="text-gold-500" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
