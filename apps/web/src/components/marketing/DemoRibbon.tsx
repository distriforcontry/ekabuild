"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseCircle, InfoCircle } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";

/** Shown only in the static GitHub Pages build: what works here and where the full platform lives. */
export function DemoRibbon() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try {
      setOpen(sessionStorage.getItem("eka_demo_note") !== "0");
    } catch {
      setOpen(true);
    }
  }, []);
  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem("eka_demo_note", "0");
    } catch {}
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 2.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-4 left-4 z-40 flex max-w-[min(420px,calc(100vw-6rem))] items-start gap-3 rounded-2xl border border-gold-500/25 bg-ink-900/90 p-3.5 pr-10 shadow-lift backdrop-blur-xl"
          role="note"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
            <InfoCircle size={18} variant="Bulk" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
              {t("landing.demo.title")}
              <span className="rounded-md bg-gold-gradient px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-onyx">{t("landing.demo.badge")}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">{t("landing.demo.text")}</p>
            <a href={t("common.contact.phoneHref")} className="mt-1.5 inline-block font-mono text-xs font-semibold text-gold-300 hover:text-gold-200">
              {t("common.contact.phone")}
            </a>
          </div>
          <button type="button" onClick={close} aria-label={t("landing.demo.close")} className="absolute right-2.5 top-2.5 grid size-7 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:text-stone-100">
            <CloseCircle size={16} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
