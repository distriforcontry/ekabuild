import { ShieldTick } from "iconsax-reactjs";
import { getI18n } from "@/i18n/server";

/** Text-only band of what the platform verifies (no partner logos, no implied endorsements). */
export async function TrustMarquee() {
  const { t, raw } = await getI18n();
  const items = raw<string[]>("landing.marquee.items") ?? [];
  const loop = [...items, ...items];

  return (
    <section id="trust" aria-label={t("landing.marquee.label")} className="relative scroll-mt-24 border-y border-line bg-ink-900/40">
      <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="hidden shrink-0 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400 md:flex">
          <span className="h-px w-6 bg-gold-500/60" />
          {t("landing.marquee.label")}
        </div>
        <div className="mask-fade-x relative min-w-0 flex-1 overflow-hidden">
          <ul className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {loop.map((item, i) => (
              <li
                key={i}
                aria-hidden={i >= items.length || undefined}
                className="flex shrink-0 items-center gap-2.5 whitespace-nowrap pr-10 text-sm font-medium text-ink-200"
              >
                <ShieldTick size={18} variant="Bulk" className="text-gold-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
