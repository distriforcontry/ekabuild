import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ScanBarcode } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { Container } from "../primitives";
import { InView, Magnetic } from "../motion";
import { RevealHeading } from "../text";
import { RENDERS } from "../renders";
import { QrTile } from "./QrTile";

/**
 * "Sertifikatni 3 soniyada tekshiring" — certificate check banner with the QR motif.
 * `compact` is the slim strip used at the top of the footer on every public page.
 */
export async function VerifyBanner({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  const { t } = await getI18n();

  if (variant === "compact") {
    return (
      <InView className={cn("eka-iv-up relative isolate overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900", className)}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-gold-500/12 via-gold-500/[0.04] to-transparent" />
          <div className="bg-blueprint absolute inset-0 opacity-60 [mask-image:linear-gradient(to_right,black,transparent_70%)]" />
        </div>
        <div className="flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center md:p-6">
          <QrTile size="sm" label={t("landing.banners.verify.qrLabel")} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">{t("landing.banners.verify.eyebrow")}</div>
            <div className="mt-1 font-display text-2xl text-stone-100 md:text-3xl">{t("landing.footer.verifyTitle")}</div>
            <p className="mt-1 text-sm text-ink-300">{t("landing.footer.verifyText")}</p>
          </div>
          <Magnetic>
            <Button asChild variant="gold" size="lg" className="eka-shine group">
              <Link href="/verify">
                <ScanBarcode variant="Bulk" />
                {t("landing.footer.verifyCta")}
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </Magnetic>
        </div>
      </InView>
    );
  }

  const img = RENDERS.heritage;
  return (
    <section className={cn("relative py-20 md:py-28", className)}>
      <Container>
        <div className="eka-border rounded-[2rem]">
          <div aria-hidden className="eka-border-spin" />
          <div className="eka-dark relative isolate overflow-hidden rounded-[calc(2rem-1px)] bg-[#0f0f10]">
            {/* render, heavily graded — this banner is dark in both themes */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                srcSet={img.srcSet}
                sizes="(min-width: 1024px) 60vw, 100vw"
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-45 [mask-image:linear-gradient(to_left,black_20%,transparent_85%)] lg:w-[70%]"
              />
              <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_75%_50%,rgb(201_164_100/0.18),transparent_70%)]" />
              <div className="bg-blueprint absolute inset-0 opacity-50 [mask-image:linear-gradient(to_right,black,transparent_60%)]" />
              <div className="bg-noise absolute inset-0" />
            </div>

            <div className="grid items-center gap-12 px-6 py-14 sm:px-10 md:py-16 lg:grid-cols-12 lg:gap-8 lg:px-14">
              <div className="lg:col-span-7">
                <RevealHeading
                  onImage
                  eyebrow={t("landing.banners.verify.eyebrow")}
                  title={t("landing.banners.verify.title")}
                  accent={t("landing.banners.verify.accent")}
                  description={t("landing.banners.verify.text")}
                  size="md"
                />
                <InView className="eka-iv-up mt-9" style={{ "--d": "500ms" } as CSSProperties}>
                  <Magnetic>
                    <Button asChild variant="gold" size="xl" className="eka-shine group">
                      <Link href="/verify">
                        <ScanBarcode variant="Bulk" />
                        {t("landing.banners.verify.cta")}
                        <ArrowRight className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </Magnetic>
                </InView>
              </div>
              <InView className="eka-iv-scale flex justify-center lg:col-span-5" style={{ "--d": "200ms" } as CSSProperties}>
                <QrTile
                  label={t("landing.banners.verify.qrLabel")}
                  verifiedText={t("landing.banners.verify.verified")}
                  scanningText={t("landing.banners.verify.scanning")}
                />
              </InView>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
