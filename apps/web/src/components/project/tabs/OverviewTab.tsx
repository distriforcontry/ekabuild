"use client";
import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Book1, Buildings, Call, Global, Grid5, Setting4, Sms, Verify } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { initials } from "@/lib/utils";
import { InfoRow } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "../ProjectProvider";
import { CopyButton, Section } from "../bits";

export function OverviewTab() {
  const { project: p, setTab } = useProject();
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const dev = p.developer;
  const sum = p.unitsSummary ?? { AVAILABLE: p.unitsAvailable, RESERVED: 0, SOLD: Math.max(0, p.unitsTotal - p.unitsAvailable) };
  const total = Math.max(1, sum.AVAILABLE + sum.RESERVED + sum.SOLD);

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: t("catalog.overview.rows.type"), value: label("projectType", p.type) },
    { label: t("catalog.overview.rows.status"), value: <StatusBadge kind="projectStatus" value={p.status} /> },
    { label: t("catalog.overview.rows.floors"), value: p.floors, mono: true },
    { label: t("catalog.overview.rows.sections"), value: p.sections ?? 1, mono: true },
    { label: t("catalog.overview.rows.totalArea"), value: fmt.area(p.totalArea), mono: true },
    { label: t("catalog.overview.rows.landArea"), value: fmt.area(p.landArea), mono: true },
    { label: t("catalog.overview.rows.unitsTotal"), value: p.unitsTotal, mono: true },
    { label: t("catalog.overview.rows.unitsAvailable"), value: p.unitsAvailable, mono: true },
    {
      label: t("catalog.overview.rows.cadastreNumber"),
      value: p.cadastreNumber ? (
        <span className="inline-flex items-center gap-1 font-mono">
          {p.cadastreNumber}
          <CopyButton value={p.cadastreNumber} />
        </span>
      ) : (
        "—"
      ),
    },
    { label: t("catalog.overview.rows.startDate"), value: fmt.date(p.startDate) },
    { label: t("catalog.overview.rows.plannedEndDate"), value: fmt.date(p.plannedEndDate) },
    ...(p.actualEndDate ? [{ label: t("catalog.overview.rows.actualEndDate"), value: fmt.date(p.actualEndDate) }] : []),
    { label: t("catalog.overview.rows.priceFrom"), value: fmt.money(p.priceFrom, p.currency), mono: true },
    { label: t("catalog.overview.rows.pricePerSqm"), value: fmt.money(p.pricePerSqm, p.currency), mono: true },
    ...(p.packagePrice ? [{ label: t("catalog.overview.rows.packagePrice"), value: fmt.money(p.packagePrice, p.currency), mono: true }] : []),
    { label: t("catalog.overview.rows.region"), value: fmt.region(p.region) },
    ...(p.district ? [{ label: t("catalog.overview.rows.district"), value: tr(p.district) }] : []),
    { label: t("catalog.overview.rows.address"), value: tr(p.address) },
  ];

  const half = Math.ceil(rows.length / 2);

  const devRows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    ...(dev.legalName ? [{ label: t("catalog.overview.developerRows.legalName"), value: tr(dev.legalName) }] : []),
    { label: t("catalog.overview.developerRows.tin"), value: dev.tin, mono: true },
    ...(dev.director ? [{ label: t("catalog.overview.developerRows.director"), value: tr(dev.director) }] : []),
    ...(dev.foundedYear ? [{ label: t("catalog.overview.developerRows.founded"), value: dev.foundedYear, mono: true }] : []),
    ...(dev.licenseNumber ? [{ label: t("catalog.overview.developerRows.license"), value: dev.licenseNumber, mono: true }] : []),
    ...(typeof dev.projectsCount === "number" ? [{ label: t("catalog.overview.developerRows.projects"), value: dev.projectsCount, mono: true }] : []),
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <Section icon={Book1} title={t("catalog.overview.about")}>
          {p.description ? (
            <div className="prose-eka max-w-none text-[15px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tr(p.description)}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-ink-400">{t("catalog.overview.noDescription")}</p>
          )}
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section icon={Setting4} title={t("catalog.overview.specs")}>
          <div className="grid gap-x-10 md:grid-cols-2">
            <div>
              {rows.slice(0, half).map((r) => (
                <InfoRow key={r.label} label={r.label} value={r.value} mono={r.mono} />
              ))}
            </div>
            <div>
              {rows.slice(half).map((r) => (
                <InfoRow key={r.label} label={r.label} value={r.value} mono={r.mono} />
              ))}
            </div>
          </div>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section
          icon={Grid5}
          title={t("catalog.overview.unitsTitle")}
          description={t("catalog.overview.unitsTotal", { count: sum.AVAILABLE + sum.RESERVED + sum.SOLD })}
          action={
            <Button variant="outline" size="sm" onClick={() => setTab("units", { scroll: true })}>
              {t("catalog.detail.actions.chooseUnit")} <ArrowRight size={14} />
            </Button>
          }
        >
          <div className="flex h-3 overflow-hidden rounded-full bg-fg/6">
            <div className="h-full bg-success transition-all duration-1000" style={{ width: `${(sum.AVAILABLE / total) * 100}%` }} />
            <div className="h-full bg-warning transition-all duration-1000" style={{ width: `${(sum.RESERVED / total) * 100}%` }} />
            <div className="h-full bg-ink-500 transition-all duration-1000" style={{ width: `${(sum.SOLD / total) * 100}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                ["AVAILABLE", "bg-success", sum.AVAILABLE],
                ["RESERVED", "bg-warning", sum.RESERVED],
                ["SOLD", "bg-ink-500", sum.SOLD],
              ] as const
            ).map(([k, c, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-ink-850 p-3.5">
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span className={`size-2 rounded-full ${c}`} />
                  {label("unitStatus", k)}
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold text-stone-100">{v}</div>
              </div>
            ))}
          </div>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section
          icon={Buildings}
          title={t("catalog.overview.developer")}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/developers/${dev.id}`}>
                {t("catalog.overview.viewDeveloper")} <ArrowRight size={14} />
              </Link>
            </Button>
          }
        >
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex items-start gap-4 md:w-2/5">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-ink-800 text-lg font-semibold text-gold-200">
                {dev.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dev.logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  initials(dev.name)
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-lg font-semibold text-stone-100">
                  {tr(dev.name)}
                  {dev.status === "VERIFIED" && <Verify size={18} variant="Bold" className="text-gold-400" />}
                </div>
                <div className="mt-1">
                  <StatusBadge kind="verification" value={dev.status} />
                </div>
                {dev.description && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-300">{tr(dev.description)}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {dev.phone && (
                    <a href={`tel:${dev.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200">
                      <Call size={14} /> {dev.phone}
                    </a>
                  )}
                  {dev.email && (
                    <a href={`mailto:${dev.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200">
                      <Sms size={14} /> {dev.email}
                    </a>
                  )}
                  {dev.website && (
                    <a
                      href={dev.website.startsWith("http") ? dev.website : `https://${dev.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200"
                    >
                      <Global size={14} /> {dev.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {devRows.map((r) => (
                <InfoRow key={r.label} label={r.label} value={r.value} mono={r.mono} />
              ))}
            </div>
          </div>
        </Section>
      </Reveal>
    </div>
  );
}
