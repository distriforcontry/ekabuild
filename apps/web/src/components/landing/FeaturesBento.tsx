import {
  Clipboard,
  DocumentText,
  Edit2,
  I3DRotate,
  Location,
  Map1,
  Messages3,
  RecordCircle,
  SearchStatus,
  StatusUp,
  TickCircle,
  Timer1,
} from "iconsax-reactjs";
import type { Icon as IconType } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { RevealHeading } from "@/components/marketing/text";
import { TrustRing } from "@/components/ui/trust-ring";
import { StatusBadge } from "@/components/ui/status-badge";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { OpenSupportButton } from "@/components/support/OpenSupportButton";
import { SpotlightCard } from "./SpotlightCard";
import { DemoBar, SignatureDraw, TypingDots, WireframeBuilding } from "./FeatureVisuals";
import { cn } from "@/lib/utils";

function CardHead({ Icon, title, text, className }: { Icon: IconType; title: string; text: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <span className="grid size-11 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition-all duration-500 group-hover/spot:border-gold-400/60 group-hover/spot:bg-gold-gradient group-hover/spot:text-onyx">
        <Icon size={20} variant="Bulk" />
      </span>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-stone-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300">{text}</p>
    </div>
  );
}

export async function FeaturesBento() {
  const { t, raw, label } = await getI18n();
  const docs = raw<string[]>("landing.features.demoDocs") ?? [];
  const timeline = raw<string[]>("landing.features.demoTimeline") ?? [];
  const factors = (raw<{ title: string; max: string }[]>("landing.pages.about.factors") ?? []).slice(0, 4);
  const demoScores = [15, 23, 15, 17];
  const hashes = ["9f2c…e41a", "4b7d…02c9", "c81e…7f3b"];

  return (
    <section id="features" className="relative scroll-mt-24 py-24 md:py-32">
      <Container>
        <RevealHeading eyebrow={t("landing.features.eyebrow")} title={t("landing.features.title")} description={t("landing.features.description")} />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(250px,auto)]">
          {/* 3D model & drawings */}
          <Reveal className="md:col-span-2 lg:row-span-2">
            <SpotlightCard className="flex h-full flex-col p-6 md:p-8">
              <CardHead Icon={I3DRotate} title={t("landing.features.model.title")} text={t("landing.features.model.text")} />
              <div className="relative mt-6 flex flex-1 items-end justify-center">
                <div aria-hidden className="bg-blueprint absolute inset-0 rounded-2xl opacity-80 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
                <WireframeBuilding className="relative h-auto w-full max-w-[440px]" />
                <div className="absolute right-0 top-2 flex flex-col items-end gap-2">
                  {["GLB", "IFC", "DWG", "PDF"].map((f) => (
                    <span key={f} className="rounded-md border border-line bg-ink-850/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-300 backdrop-blur">
                      {f}
                    </span>
                  ))}
                </div>
                <span className="absolute bottom-2 left-0 inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-ink-900/80 px-3 py-1 font-mono text-[11px] text-gold-200 backdrop-blur">
                  <RecordCircle size={12} variant="Bold" className="animate-pulse" /> 360°
                </span>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* document registry */}
          <Reveal className="md:col-span-2" delay={0.05}>
            <SpotlightCard className="grid h-full gap-6 p-6 md:p-8 xl:grid-cols-[1fr_1.1fr]">
              <CardHead Icon={DocumentText} title={t("landing.features.registry.title")} text={t("landing.features.registry.text")} />
              <ul className="space-y-2.5 self-center">
                {docs.map((d, i) => (
                  <li key={d} className="flex items-center gap-3 rounded-xl border border-line bg-ink-850/60 px-3 py-2.5 transition-colors group-hover/spot:border-line-strong">
                    <DocumentText size={18} variant="Bulk" className="shrink-0 text-gold-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-stone-100">{d}</div>
                      <div className="font-mono text-[10px] text-ink-500">sha256 · {hashes[i % hashes.length]}</div>
                    </div>
                    <TickCircle size={18} variant="Bold" className="shrink-0 text-success" />
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>

          {/* cadastre & map */}
          <Reveal delay={0.1}>
            <SpotlightCard className="flex h-full flex-col p-6">
              <CardHead Icon={Map1} title={t("landing.features.cadastre.title")} text={t("landing.features.cadastre.text")} />
              <div className="relative mt-5 h-28 flex-1 overflow-hidden rounded-2xl border border-line bg-ink-850">
                <div aria-hidden className="bg-blueprint absolute inset-0" />
                <svg viewBox="0 0 200 100" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
                  <path d="M10 70 L60 55 L75 90 L20 98 Z" className="fill-ink-700 stroke-ink-500" strokeWidth="0.8" />
                  <path d="M120 10 L180 20 L170 60 L115 50 Z" className="fill-ink-700 stroke-ink-500" strokeWidth="0.8" />
                  <path d="M70 25 L118 32 L112 70 L64 62 Z" fill="rgb(201 164 100 / 0.18)" stroke="#c9a464" strokeWidth="1.4" strokeDasharray="4 3" />
                  <path d="M0 48 C 50 40, 120 80, 200 70" className="stroke-ink-500" strokeWidth="3" fill="none" />
                </svg>
                <span className="absolute left-[46%] top-[34%] -translate-x-1/2 -translate-y-full">
                  <span className="absolute left-1/2 top-full size-6 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full bg-gold-400" />
                  <Location size={26} variant="Bold" className="relative text-gold-400 drop-shadow" />
                </span>
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <TickCircle size={11} variant="Bold" /> {t("landing.features.demoMatch")}
                </span>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* inspections */}
          <Reveal delay={0.15}>
            <SpotlightCard className="flex h-full flex-col p-6">
              <CardHead Icon={SearchStatus} title={t("landing.features.inspections.title")} text={t("landing.features.inspections.text")} />
              <ul className="mt-5 space-y-2">
                {(
                  [
                    ["FOUNDATION", "PASSED"],
                    ["FRAME", "PASSED"],
                    ["ENGINEERING", "ISSUES"],
                  ] as const
                ).map(([type, result]) => (
                  <li key={type} className="flex items-center justify-between gap-2 rounded-lg bg-fg/[0.03] px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-2 text-ink-200">
                      <Clipboard size={14} variant="Bulk" className="text-gold-400" />
                      {label("inspectionType", type)}
                    </span>
                    <StatusBadge kind="inspectionResult" value={result} />
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>

          {/* E-IMZO contracts */}
          <Reveal className="md:col-span-2" delay={0.05}>
            <SpotlightCard className="grid h-full gap-6 p-6 md:p-8 xl:grid-cols-[1fr_1.1fr]">
              <CardHead Icon={Edit2} title={t("landing.features.eimzo.title")} text={t("landing.features.eimzo.text")} />
              <div className="relative self-center rounded-2xl border border-line bg-ink-850/60 p-4">
                <div className="flex items-center justify-between text-[11px] text-ink-400">
                  <span className="font-mono">SHA-256 · a41f…9e0d</span>
                  <span className="rounded-full border border-gold-500/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-gold-300">E-IMZO</span>
                </div>
                <SignatureDraw className="mt-1 h-14 w-full" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["BUYER", "SELLER"] as const).map((r) => (
                    <div key={r} className="flex items-center gap-2 rounded-lg bg-fg/[0.03] px-2.5 py-2 text-xs">
                      <TickCircle size={14} variant="Bold" className="text-success" />
                      <span className="text-ink-200">{label("signerRole", r)}</span>
                      <span className="ml-auto text-[10px] text-success">{t("landing.features.demoSigned")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* trust score */}
          <Reveal className="md:col-span-2" delay={0.1}>
            <SpotlightCard className="grid h-full items-center gap-6 p-6 md:p-8 xl:grid-cols-[1fr_1.1fr]">
              <CardHead Icon={StatusUp} title={t("landing.features.trust.title")} text={t("landing.features.trust.text")} />
              <div className="flex items-center gap-5">
                <TrustRing score={92} size={112} stroke={8} />
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {factors.map((f, i) => (
                    <li key={f.title}>
                      <div className="mb-1 flex justify-between gap-2 text-[11px]">
                        <span className="truncate text-ink-300">{f.title}</span>
                        <span className="font-mono text-ink-400">
                          {demoScores[i]}/{f.max}
                        </span>
                      </div>
                      <DemoBar value={demoScores[i] ?? 0} max={Number(f.max) || 1} delay={0.1 * i} />
                    </li>
                  ))}
                </ul>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* after the purchase */}
          <Reveal className="md:col-span-2" delay={0.05}>
            <SpotlightCard className="grid h-full gap-6 p-6 md:p-8 xl:grid-cols-[1fr_1.1fr]">
              <CardHead Icon={Timer1} title={t("landing.features.afterSale.title")} text={t("landing.features.afterSale.text")} />
              <ol className="relative self-center border-l border-line-strong pl-5">
                {timeline.map((item, i) => (
                  <li key={item} className="relative pb-4 last:pb-0">
                    <span
                      className={cn(
                        "absolute -left-[26.5px] top-0.5 size-3 rounded-full border-2",
                        i === 0 ? "border-gold-400 bg-gold-400 shadow-glow" : "border-line-strong bg-ink-900",
                      )}
                    />
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">{label("progressPhase", "POST_HANDOVER")}</div>
                    <div className="text-sm text-stone-100">{item}</div>
                  </li>
                ))}
              </ol>
            </SpotlightCard>
          </Reveal>

          {/* support chat */}
          <Reveal className="md:col-span-2" delay={0.1}>
            <SpotlightCard className="grid h-full gap-6 p-6 md:p-8 xl:grid-cols-[1fr_1.1fr]">
              <div>
                <CardHead Icon={Messages3} title={t("landing.features.support.title")} text={t("landing.features.support.text")} />
                <OpenSupportButton variant="outline" size="sm" className="mt-5">
                  {t("landing.contactStrip.chat")}
                </OpenSupportButton>
              </div>
              <div className="space-y-2.5 self-center">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold-gradient px-3.5 py-2.5 text-[13px] text-onyx">{t("landing.features.demoChatQ")}</div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-ink-850 px-3.5 py-2.5 text-[13px] text-ink-100">
                  {t("landing.features.demoChatA")}
                </div>
                <div className="inline-flex rounded-2xl rounded-bl-md border border-line bg-ink-850 px-3.5 py-3">
                  <TypingDots />
                </div>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
