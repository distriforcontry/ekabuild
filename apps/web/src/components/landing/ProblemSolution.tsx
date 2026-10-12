import { ArrowDown, ArrowRight, Copy, LocationCross, LocationTick, Lock, ScanBarcode, ShieldCross, TaskSquare, Timer1 } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { RevealHeading } from "@/components/marketing/text";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { SpotlightCard } from "./SpotlightCard";

type Item = { problem: string; problemText: string; solution: string; solutionText: string };

const ICONS = [
  { P: Copy, S: Lock },
  { P: ShieldCross, S: ScanBarcode },
  { P: LocationCross, S: LocationTick },
  { P: Timer1, S: TaskSquare },
];

export async function ProblemSolution() {
  const { t, raw } = await getI18n();
  const items = raw<Item[]>("landing.problems.items") ?? [];

  return (
    <section id="problems" className="relative scroll-mt-24 py-24 md:py-32">
      <Container>
        <RevealHeading
            align="center"
            eyebrow={t("landing.problems.eyebrow")}
            title={t("landing.problems.title")}
            description={t("landing.problems.description")}
          />

        <ol className="mx-auto mt-16 max-w-6xl space-y-5">
          {items.map((it, i) => {
            const { P, S } = ICONS[i % ICONS.length]!;
            return (
              <Reveal as="li" key={i} delay={i * 0.06}>
                <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.15fr] md:gap-4">
                  {/* problem */}
                  <div className="relative overflow-hidden rounded-3xl border border-danger/15 bg-danger/[0.035] p-6 md:p-7">
                    <div aria-hidden className="absolute -left-16 -top-16 size-40 rounded-full bg-danger/10 blur-3xl" />
                    <div className="relative flex items-start gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-danger/25 bg-danger/10 text-danger">
                        <P size={20} variant="Bulk" />
                      </span>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-danger/90">
                          {t("landing.problems.problemLabel")} · {String(i + 1).padStart(2, "0")}
                        </div>
                        <h3 className="mt-1.5 text-lg font-semibold text-stone-100">{it.problem}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{it.problemText}</p>
                      </div>
                    </div>
                  </div>

                  {/* connector */}
                  <div className="flex items-center justify-center" aria-hidden>
                    <span className="grid size-11 place-items-center rounded-full border border-gold-500/40 bg-ink-900 text-gold-300 shadow-glow">
                      <ArrowRight size={18} className="hidden md:block" />
                      <ArrowDown size={18} className="md:hidden" />
                    </span>
                  </div>

                  {/* solution */}
                  <SpotlightCard className="border-gold-500/20 bg-gradient-to-br from-gold-500/[0.07] to-ink-900/70 p-6 hover:translate-y-0 md:p-7">
                    <div className="flex items-start gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
                        <S size={20} variant="Bold" />
                      </span>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-400">{t("landing.problems.solutionLabel")}</div>
                        <h3 className="mt-1.5 text-lg font-semibold text-stone-100">{it.solution}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{it.solutionText}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
