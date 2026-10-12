import { QuoteUp, Star1 } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { RevealHeading } from "@/components/marketing/text";
import { getI18n } from "@/i18n/server";
import { initials } from "@/lib/utils";
import { Container } from "@/components/marketing/primitives";
import { SpotlightCard } from "./SpotlightCard";

type Item = { quote: string; name: string; role: string };

export async function Testimonials() {
  const { t, raw } = await getI18n();
  const items = raw<Item[]>("landing.testimonials.items") ?? [];

  return (
    <section id="testimonials" className="relative py-24 md:py-32">
      <Container>
        <RevealHeading align="center" eyebrow={t("landing.testimonials.eyebrow")} title={t("landing.testimonials.title")} />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.name} delay={i * 0.08} className={i === 1 ? "md:translate-y-8" : undefined}>
              <SpotlightCard as="article" className="flex h-full flex-col p-7">
                <QuoteUp size={34} variant="Bulk" className="text-gold-400" />
                <div className="mt-4 flex gap-0.5 text-gold-400" aria-hidden>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star1 key={s} size={14} variant="Bold" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 font-display text-[22px] leading-snug text-stone-100">“{it.quote}”</blockquote>
                <footer className="mt-7 flex items-center gap-3 border-t border-line pt-5">
                  <span className="grid size-11 place-items-center rounded-full bg-gold-gradient text-sm font-bold text-onyx">{initials(it.name)}</span>
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{it.name}</div>
                    <div className="text-xs text-ink-400">{it.role}</div>
                  </div>
                </footer>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
