import { Buildings2, Chart, ClipboardTick, HomeTrendUp, People, ShieldTick } from "iconsax-reactjs";
import { CountUp, Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import type { PublicStats } from "@/lib/types";
import { Container } from "@/components/marketing/primitives";

const ITEMS = [
  { key: "projects", Icon: Buildings2 },
  { key: "developers", Icon: People },
  { key: "verifiedCertificates", Icon: ShieldTick },
  { key: "inspections", Icon: ClipboardTick },
  { key: "unitsSold", Icon: HomeTrendUp },
  { key: "avgTrust", Icon: Chart },
] as const;

export async function StatsBand({ stats }: { stats: PublicStats | null }) {
  const { t } = await getI18n();
  const s: PublicStats = stats ?? { projects: 0, developers: 0, verifiedCertificates: 0, inspections: 0, unitsSold: 0, avgTrust: 0, regions: 0 };

  return (
    <section id="stats" aria-labelledby="stats-title" className="relative isolate overflow-hidden border-y border-line py-20 md:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-blueprint absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-transparent to-ink-950" />
        <div className="absolute left-1/2 top-1/2 h-64 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500 opacity-[0.09] blur-[100px]" />
      </div>
      <Container>
        <Reveal className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">
            <span className="h-px w-8 bg-gold-500/60" />
            {t("landing.stats.eyebrow")}
            <span className="h-px w-8 bg-gold-500/60" />
          </div>
          <h2 id="stats-title" className="mt-4 font-display text-4xl text-stone-100 md:text-5xl">
            {t("landing.stats.title")}
          </h2>
          {!stats && <p className="mt-3 text-xs text-ink-400">{t("landing.stats.updating")}</p>}
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3 lg:grid-cols-6">
          {ITEMS.map(({ key, Icon }, i) => (
            <Reveal key={key} delay={i * 0.06} className="group bg-ink-950/90 p-6 text-center transition-colors hover:bg-ink-900 md:p-8">
              <Icon size={22} variant="Bulk" className="mx-auto text-gold-400 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <div className="mt-4 font-mono text-3xl font-semibold tracking-tight text-stone-100 md:text-4xl">
                <CountUp value={Number(s[key]) || 0} />
                {key === "avgTrust" && <span className="text-lg text-ink-400">/100</span>}
              </div>
              <div className="mt-2 text-xs leading-snug text-ink-300 md:text-sm">{t(`landing.stats.${key}`)}</div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
