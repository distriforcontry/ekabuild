"use client";
import * as React from "react";
import Link from "next/link";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { ArrowRight, Briefcase, Buildings2, Home2, TickCircle } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { RevealHeading } from "@/components/marketing/text";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Key = "buyers" | "companies" | "developers";
type Block = { title: string; text: string; points: string[]; cta: string; stat: string; statValue: string };

const META: Record<Key, { Icon: typeof Home2; href: string }> = {
  buyers: { Icon: Home2, href: "/register" },
  companies: { Icon: Briefcase, href: "/register?type=company" },
  developers: { Icon: Buildings2, href: "/register?type=developer" },
};

export function AudienceTabs() {
  const { t, raw } = useI18n();
  const [tab, setTab] = React.useState<Key>("buyers");
  const keys: Key[] = ["buyers", "companies", "developers"];
  const block = raw<Block>(`landing.audience.${tab}`);
  const { Icon, href } = META[tab];

  return (
    <section id="audience" className="relative isolate scroll-mt-24 overflow-hidden py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute left-[-20%] top-1/3 -z-10 size-[560px] rounded-full bg-gold-500 opacity-[0.07] blur-[140px]" />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealHeading align="center" eyebrow={t("landing.audience.eyebrow")} title={t("landing.audience.title")} description={t("landing.audience.description")} />

        <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as Key)} className="mt-12">
          <Reveal delay={0.1} className="flex justify-center">
            <TabsPrimitive.List className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-ink-900/80 p-1.5 backdrop-blur [scrollbar-width:none]">
              {keys.map((k) => {
                const active = k === tab;
                const I = META[k].Icon;
                return (
                  <TabsPrimitive.Trigger
                    key={k}
                    value={k}
                    className={cn(
                      "relative flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors sm:px-6",
                      active ? "text-onyx" : "text-ink-300 hover:text-stone-100",
                    )}
                  >
                    {active && <motion.span layoutId="audience-tab" className="absolute inset-0 rounded-xl bg-gold-gradient shadow-glow" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <I size={18} variant={active ? "Bold" : "Linear"} className="relative" />
                    <span className="relative">{t(`landing.audience.tabs.${k}`)}</span>
                  </TabsPrimitive.Trigger>
                );
              })}
            </TabsPrimitive.List>
          </Reveal>

          {keys.map((k) => (
            <TabsPrimitive.Content key={k} value={k} className="focus-visible:outline-none">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 grid items-stretch gap-6 lg:grid-cols-12"
                  >
                    <div className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card sm:p-10 lg:col-span-7">
                      <h3 className="font-display text-3xl leading-tight text-stone-100 sm:text-4xl">{block?.title}</h3>
                      <p className="mt-4 text-base leading-relaxed text-ink-300">{block?.text}</p>
                      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                        {(block?.points ?? []).map((p, i) => (
                          <motion.li
                            key={p}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className="flex items-start gap-3 text-sm text-ink-100"
                          >
                            <TickCircle size={18} variant="Bold" className="mt-0.5 shrink-0 text-gold-400" />
                            {p}
                          </motion.li>
                        ))}
                      </ul>
                      <Button asChild variant="gold" size="lg" className="group mt-10">
                        <Link href={href}>
                          {block?.cta}
                          <ArrowRight className="transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </div>

                    <div className="relative overflow-hidden rounded-3xl border border-gold-500/20 bg-gradient-to-br from-gold-500/15 via-ink-900 to-ink-900 p-8 lg:col-span-5">
                      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-60" />
                      <div aria-hidden className="absolute -bottom-24 -right-24 size-72 rounded-full bg-gold-500 opacity-20 blur-3xl" />
                      <div className="relative flex h-full min-h-72 flex-col justify-between">
                        <motion.span
                          initial={{ scale: 0.8, rotate: -8, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 18 }}
                          className="grid size-20 place-items-center rounded-3xl bg-gold-gradient text-onyx shadow-glow"
                        >
                          <Icon size={38} variant="Bold" />
                        </motion.span>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-400">{block?.stat}</div>
                          <div className="text-gold-gradient mt-2 font-display text-6xl sm:text-7xl">{block?.statValue}</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
            </TabsPrimitive.Content>
          ))}
        </TabsPrimitive.Root>
      </div>
    </section>
  );
}
