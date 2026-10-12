"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Add, Call } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/misc";
import { OpenSupportButton } from "@/components/support/OpenSupportButton";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type QA = { q: string; a: string };

export function Faq() {
  const { t, raw } = useI18n();
  const items = raw<QA[]>("landing.faq.items") ?? [];
  const [open, setOpen] = React.useState<number | null>(0);
  const baseId = React.useId();

  return (
    <section id="faq" className="relative scroll-mt-24 border-t border-line bg-ink-900/30 py-24 md:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
          <Reveal>
            <SectionHeading eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} description={t("landing.faq.description")} />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap gap-3">
              <OpenSupportButton variant="gold" size="lg">
                {t("landing.faq.ask")}
              </OpenSupportButton>
              <a
                href={t("common.contact.phoneHref")}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-5 font-mono text-sm font-semibold text-stone-100 transition hover:border-gold-500/40 hover:text-gold-300"
              >
                <Call size={16} variant="Bulk" className="text-gold-400" />
                {t("common.contact.phone")}
              </a>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-ink-900/70 shadow-card">
            {items.map((it, i) => {
              const isOpen = open === i;
              const btnId = `${baseId}-q${i}`;
              const panelId = `${baseId}-a${i}`;
              return (
                <Reveal as="li" key={i} delay={Math.min(i, 6) * 0.04} y={12}>
                  <h3>
                    <button
                      id={btnId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full cursor-pointer items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-fg/[0.03] md:px-8 md:py-6"
                    >
                      <span className="w-7 shrink-0 font-mono text-xs text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                      <span className={cn("flex-1 text-base font-semibold transition-colors md:text-lg", isOpen ? "text-gold-200" : "text-stone-100 group-hover:text-gold-200")}>
                        {it.q}
                      </span>
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border transition-all duration-500",
                          isOpen ? "rotate-45 border-gold-400 bg-gold-gradient text-onyx" : "border-line-strong text-ink-300 group-hover:border-gold-500/50",
                        )}
                      >
                        <Add size={18} />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={btnId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-300 sm:pl-[4.25rem] md:px-8 md:pb-7 md:pl-[5.25rem]">{it.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
