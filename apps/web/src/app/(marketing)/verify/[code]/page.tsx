import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { cache } from "react";
import { ArrowRight, Building, DocumentCode, Refresh, SearchNormal1, Verify as VerifyIcon, Warning2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { getI18n } from "@/i18n/server";
import type { CertificateItem } from "@/lib/types";
import { Breadcrumbs, Container } from "@/components/marketing/primitives";
import { fetchPublic } from "@/components/marketing/server-data";
import { fmtDate, fmtDateTime } from "@/components/marketing/format";
import { CertificateSeal, type SealStatus } from "@/components/marketing/verify/CertificateSeal";
import { QrCard } from "@/components/marketing/verify/QrCard";
import { ReportFraudDialog } from "@/components/marketing/ReportFraudDialog";
import { CopyButton } from "@/components/marketing/CopyButton";
import { VerifyWidget } from "@/components/landing/VerifyWidget";
import { cn } from "@/lib/utils";

type VerifyResponse = {
  certificate: CertificateItem;
  project: { slug: string; name: string; address: string; region: string; developer: { name: string; tin: string; status: string } } | null;
  document: { title: string; sha256: string } | null;
};

type Params = { params: Promise<{ code: string }> };

const safeDecode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

const getResult = cache((code: string) => fetchPublic<VerifyResponse>(`/verify/${encodeURIComponent(code)}`));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const { t } = await getI18n();
  return {
    title: t("landing.pages.verifyResult.metaTitle", { code: safeDecode(code) }),
    description: t("landing.pages.verify.metaDescription"),
    robots: { index: false, follow: true },
  };
}

async function pageUrl(code: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ekabuild.uz");
  return `${base}/verify/${encodeURIComponent(code)}`;
}

const TONE_BORDER: Record<SealStatus, string> = {
  VERIFIED: "border-success/30",
  PENDING: "border-warning/30",
  EXPIRED: "border-danger/30",
  REVOKED: "border-danger/30",
  REJECTED: "border-danger/30",
  NOT_FOUND: "border-danger/30",
  UNAVAILABLE: "border-info/30",
};
const TONE_GLOW: Record<SealStatus, string> = {
  VERIFIED: "bg-success",
  PENDING: "bg-warning",
  EXPIRED: "bg-danger",
  REVOKED: "bg-danger",
  REJECTED: "bg-danger",
  NOT_FOUND: "bg-danger",
  UNAVAILABLE: "bg-info",
};
const TONE_TEXT: Record<SealStatus, string> = {
  VERIFIED: "text-success",
  PENDING: "text-warning",
  EXPIRED: "text-danger",
  REVOKED: "text-danger",
  REJECTED: "text-danger",
  NOT_FOUND: "text-danger",
  UNAVAILABLE: "text-info",
};

export default async function VerifyResultPage({ params }: Params) {
  const { code: rawCode } = await params;
  const code = safeDecode(rawCode).trim();
  const [{ t, raw, label, tr, locale }, res, url] = await Promise.all([getI18n(), getResult(code), pageUrl(code)]);

  const data = res.data;
  const cert = data?.certificate ?? null;
  const expiredByDate = !!cert?.validUntil && new Date(cert.validUntil).getTime() < Date.now();
  const status: SealStatus = res.error
    ? "UNAVAILABLE"
    : !cert
      ? "NOT_FOUND"
      : cert.status === "VERIFIED" && expiredByDate
        ? "EXPIRED"
        : (cert.status as SealStatus);
  const checkedAt = fmtDateTime(new Date(), locale);
  const advice = raw<string[]>("landing.pages.verifyResult.advice") ?? [];
  const context = `${t("landing.pages.verifyResult.code")}: ${code}${cert ? ` · ${cert.number}` : ""}`;

  return (
    <>
      {/* ── result hero */}
      <section className="relative isolate -mt-20 overflow-hidden pb-10 pt-32 md:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_10%,black_10%,transparent_75%)]" />
          <div className={cn("absolute -top-40 left-[10%] h-[460px] w-[620px] rounded-full opacity-[0.14] blur-[120px]", TONE_GLOW[status])} />
          <div className="bg-noise absolute inset-0" />
        </div>
        <Container>
          <Breadcrumbs
            items={[
              { href: "/", label: t("landing.common.breadcrumbHome") },
              { href: "/verify", label: t("landing.pages.verifyResult.breadcrumb") },
              { label: code },
            ]}
          />
          <Reveal>
            <div className={cn("relative overflow-hidden rounded-[2rem] border bg-ink-900/80 p-6 shadow-lift backdrop-blur-xl sm:p-10", TONE_BORDER[status])}>
              <div className="grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12">
                <CertificateSeal status={status} label={t(`landing.pages.verifyResult.seal.${status}`)} className="mx-auto md:mx-0" />
                <div className="text-center md:text-left">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-ink-850 px-3 py-1">
                    <span className="text-[11px] uppercase tracking-wider text-ink-400">{t("landing.pages.verifyResult.code")}</span>
                    <span className="truncate font-mono text-xs font-semibold text-stone-100">{code}</span>
                  </div>
                  <h1 className={cn("mt-4 font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl", TONE_TEXT[status])}>
                    {t(`landing.pages.verifyResult.titles.${status}`)}
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-200 md:mx-0">{t(`landing.pages.verifyResult.texts.${status}`)}</p>
                  {cert && expiredByDate && cert.status === "VERIFIED" && (
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-danger">
                      <Warning2 size={16} variant="Bold" />
                      {t("landing.pages.verifyResult.expiredWarn", { date: fmtDate(cert.validUntil, locale) })}
                    </p>
                  )}
                  <p className="mt-4 text-xs text-ink-400">{t("landing.pages.verifyResult.checkedAt", { date: checkedAt })}</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                    {status === "UNAVAILABLE" ? (
                      <Button asChild variant="gold" size="lg">
                        <a href={`/verify/${encodeURIComponent(code)}`}>
                          <Refresh />
                          {t("landing.pages.verifyResult.retry")}
                        </a>
                      </Button>
                    ) : (
                      <ReportFraudDialog
                        context={context}
                        variant={status === "VERIFIED" ? "outline" : "danger"}
                        className={status === "VERIFIED" ? "border-danger/40 text-danger hover:border-danger hover:bg-danger/10" : undefined}
                        defaultCategory={status === "NOT_FOUND" ? "FAKE_DOCUMENT" : "FRAUD"}
                        label={t("landing.pages.verifyResult.report")}
                      />
                    )}
                    <Button asChild variant="secondary" size="lg">
                      <Link href="/verify">
                        <SearchNormal1 />
                        {t("landing.pages.verifyResult.searchAgain")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ── details */}
      <section className="pb-24">
        <Container>
          {cert && data ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <Reveal className="lg:col-span-2">
                <div className="h-full rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card md:p-8">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">
                    <VerifyIcon size={18} variant="Bulk" className="text-gold-400" />
                    {t("landing.pages.verifyResult.details")}
                  </h2>
                  <div className="mt-4">
                    <InfoRow label={t("landing.pages.verifyResult.type")} value={label("certificateType", cert.type)} />
                    <InfoRow label={t("landing.pages.verifyResult.number")} value={cert.number} mono />
                    <InfoRow label={t("landing.pages.verifyResult.issuer")} value={tr(cert.issuer)} />
                    <InfoRow label={t("landing.pages.verifyResult.issuedAt")} value={fmtDate(cert.issuedAt, locale)} />
                    <InfoRow
                      label={t("landing.pages.verifyResult.validUntil")}
                      value={
                        cert.validUntil ? (
                          <span className={expiredByDate ? "text-danger" : undefined}>{fmtDate(cert.validUntil, locale)}</span>
                        ) : (
                          t("landing.pages.verifyResult.unlimited")
                        )
                      }
                    />
                    <InfoRow label={t("landing.pages.verifyResult.verifiedAt")} value={fmtDate(cert.verifiedAt, locale)} />
                    <InfoRow label={t("landing.pages.verifyResult.status")} value={<StatusBadge kind="certificateStatus" value={cert.status} />} />
                    {cert.note && <InfoRow label={t("landing.pages.verifyResult.note")} value={tr(cert.note)} />}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card md:p-8">
                  <h2 className="text-center text-sm font-semibold text-stone-100">{t("landing.pages.verifyResult.qrTitle")}</h2>
                  <p className="mt-1 text-center text-xs text-ink-400">{t("landing.pages.verifyResult.qrText")}</p>
                  <div className="mt-5">
                    <QrCard url={url} code={code} />
                  </div>
                </div>
              </Reveal>

              {data.project && (
                <Reveal className="lg:col-span-2" delay={0.05}>
                  <div className="grid h-full gap-6 rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card sm:grid-cols-2 md:p-8">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">
                        <Building size={18} variant="Bulk" className="text-gold-400" />
                        {t("landing.pages.verifyResult.project")}
                      </h2>
                      <div className="mt-4 font-display text-3xl text-stone-100">{tr(data.project.name)}</div>
                      <p className="mt-2 text-sm text-ink-300">
                        {tr(data.project.address)}
                        {data.project.region ? `, ${tr(data.project.region)}` : ""}
                      </p>
                      <Link href={`/projects/${data.project.slug}`} className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-300">
                        {t("landing.pages.verifyResult.openProject")}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                    <div className="rounded-2xl border border-line bg-ink-850/60 p-5">
                      <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("landing.pages.verifyResult.developer")}</div>
                      <div className="mt-1.5 text-lg font-semibold text-stone-100">{tr(data.project.developer.name)}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-ink-400">{t("landing.pages.verifyResult.tin")}:</span>
                        <span className="font-mono text-stone-100">{data.project.developer.tin}</span>
                      </div>
                      <div className="mt-3">
                        <StatusBadge kind="verification" value={data.project.developer.status} />
                      </div>
                    </div>
                  </div>
                </Reveal>
              )}

              <Reveal delay={0.1} className={data.project ? undefined : "lg:col-span-3"}>
                <div className="h-full rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card md:p-8">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">
                    <DocumentCode size={18} variant="Bulk" className="text-gold-400" />
                    {t("landing.pages.verifyResult.fingerprint")}
                  </h2>
                  {data.document ? (
                    <>
                      <div className="mt-4 font-medium text-stone-100">{tr(data.document.title)}</div>
                      <p className="mt-2 text-xs leading-relaxed text-ink-400">{t("landing.pages.verifyResult.fingerprintText")}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">SHA-256</span>
                        <CopyButton value={data.document.sha256} label={t("landing.common.copyHash")} done={t("landing.common.hashCopied")} />
                      </div>
                      <code className="mt-1.5 block break-all rounded-lg border border-line bg-ink-950/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-gold-200">
                        {data.document.sha256}
                      </code>
                      <Button asChild variant="outline" size="sm" className="mt-5">
                        <Link href="/verify?tab=file#check">{t("landing.pages.verifyResult.checkFile")}</Link>
                      </Button>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-ink-400">{t("landing.pages.verifyResult.noDocument")}</p>
                  )}
                </div>
              </Reveal>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {status === "NOT_FOUND" && (
                <Reveal className="lg:col-span-5">
                  <div className="h-full rounded-3xl border border-danger/20 bg-danger/[0.04] p-6 md:p-8">
                    <h2 className="text-lg font-semibold text-stone-100">{t("landing.pages.verifyResult.adviceTitle")}</h2>
                    <ol className="mt-5 space-y-4">
                      {advice.map((a, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-200">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-danger/30 font-mono text-[11px] text-danger">{i + 1}</span>
                          {a}
                        </li>
                      ))}
                    </ol>
                  </div>
                </Reveal>
              )}
              <Reveal className={status === "NOT_FOUND" ? "lg:col-span-7" : "lg:col-span-12"} delay={0.08}>
                <div className="rounded-3xl border border-line bg-ink-900/80 p-5 shadow-card sm:p-8">
                  <VerifyWidget tabs={["code", "number", "file"]} />
                </div>
              </Reveal>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
