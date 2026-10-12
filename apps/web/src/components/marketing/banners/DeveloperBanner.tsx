import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Buildings2, TickCircle, Verify } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { Container } from "../primitives";
import { Drift, InView, Magnetic } from "../motion";
import { RevealHeading } from "../text";
import { SmartImg } from "../SmartImg";
import { RENDERS } from "../renders";

/** Developer CTA: copy + benefits on the left, the business-tower render fading in from the right. */
export async function DeveloperBanner({ className }: { className?: string }) {
  const { t, raw } = await getI18n();
  const points = raw<string[]>("landing.banners.developer.points") ?? [];
  const img = RENDERS["developer-tower"];

  return (
    <section className={cn("relative py-20 md:py-28", className)}>
      <Container>
        <div className="eka-glow relative isolate overflow-hidden rounded-[2rem] border border-line bg-ink-900 shadow-card">
          {/* render, masked into the card */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full lg:w-[62%]">
            <Drift range={30} className="absolute -inset-y-10 inset-x-0">
              <SmartImg
                src={img.src}
                srcSet={img.srcSet}
                sizes="(min-width: 1024px) 60vw, 100vw"
                lqip={img.lqip}
                className="[mask-image:linear-gradient(to_bottom,transparent_35%,black_70%)] lg:[mask-image:linear-gradient(to_right,transparent,black_42%)]"
                imgStyle={{ objectPosition: "50% 30%" }}
              />
            </Drift>
            <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-ink-900/50 to-transparent lg:bg-gradient-to-r lg:from-ink-900 lg:via-ink-900/20 lg:to-transparent" />
          </div>
          <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 -z-10 size-[460px] rounded-full bg-gold-500 opacity-[0.1] blur-[120px]" />

          <div className="grid gap-10 p-6 pb-72 sm:p-10 sm:pb-80 lg:grid-cols-12 lg:p-14">
            <div className="lg:col-span-6">
              <RevealHeading
                size="md"
                eyebrow={t("landing.banners.developer.eyebrow")}
                title={t("landing.banners.developer.title")}
                accent={t("landing.banners.developer.accent")}
                description={t("landing.banners.developer.text")}
              />
              <InView as="ul" className="mt-7 space-y-3">
                {points.map((p, i) => (
                  <li key={p} className="eka-iv-up flex items-center gap-3 text-[15px] text-ink-100" style={{ "--d": `${350 + i * 100}ms` } as CSSProperties}>
                    <TickCircle size={20} variant="Bulk" className="shrink-0 text-gold-400" />
                    {p}
                  </li>
                ))}
              </InView>
              <InView className="eka-iv-up mt-9 flex flex-col gap-3 sm:flex-row" style={{ "--d": "650ms" } as CSSProperties}>
                <Magnetic className="w-full sm:w-auto">
                  <Button asChild variant="gold" size="xl" className="eka-shine group w-full sm:w-auto">
                    <Link href="/register?type=developer">
                      <Buildings2 variant="Bulk" />
                      {t("landing.banners.developer.cta")}
                      <ArrowRight className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </Magnetic>
                <Button asChild variant="outline" size="xl">
                  <Link href="/developers">{t("landing.banners.developer.secondary")}</Link>
                </Button>
              </InView>
            </div>
          </div>

          {/* floating verified badge over the render */}
          <div className="absolute bottom-8 right-6 sm:right-10 lg:bottom-auto lg:right-14 lg:top-14">
            <div className="eka-float flex items-center gap-3 rounded-2xl border border-[#e9d5a8]/30 bg-[#0b0b0c]/60 py-2.5 pl-2.5 pr-4 text-[#f4f1ea] shadow-lift backdrop-blur-xl">
              <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e9d5a8] via-[#c9a464] to-[#8e6e3c] text-[#1f1a12]">
                <Verify size={20} variant="Bold" />
              </span>
              <span className="text-sm font-semibold">{t("landing.banners.developer.badge")}</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
