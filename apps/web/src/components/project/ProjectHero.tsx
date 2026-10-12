"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  Building,
  Buildings2,
  Calendar,
  DocumentText,
  Flag,
  Heart,
  Home2,
  Location,
  MoneySend,
  Ruler,
  Share,
  ShieldTick,
  Verify,
} from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { BuildingViewer } from "@/components/three/BuildingViewer";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "./ProjectProvider";
import { Gallery } from "./Gallery";
import { ReportDialog } from "./ReportDialog";
import { copyText } from "./bits";

/** CSS entrance (plays from the first paint, no hydration wait) — see .eka-in in globals.css */
const fade = (d: number) => ({ "--d": `${Math.round(d * 1000)}ms` }) as React.CSSProperties;

export function ProjectHero() {
  const { project: p, setTab, buy, packagePurchase, loginHref } = useProject();
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const router = useRouter();
  const [fav, setFav] = React.useState(p.viewer.isFavorite);
  const [favBusy, setFavBusy] = React.useState(false);
  const [report, setReport] = React.useState(false);

  const images = (p.gallery?.length ? p.gallery : p.coverUrl ? [p.coverUrl] : []).filter(Boolean);
  const location = [p.address, p.district ? tr(p.district) : null, fmt.region(p.region)].filter(Boolean).join(", ");

  const toggleFav = async () => {
    if (!p.viewer.authenticated) {
      toast.info(t("catalog.auth.required"));
      router.push(loginHref());
      return;
    }
    const next = !fav;
    setFav(next);
    setFavBusy(true);
    try {
      const r = await api.post<{ favorite: boolean }>(`/projects/${p.id}/favorite`);
      setFav(r.favorite);
      toast.success(r.favorite ? t("catalog.detail.actions.favoriteAdded") : t("catalog.detail.actions.favoriteRemoved"));
    } catch (e) {
      setFav(!next);
      if (e instanceof ApiError && e.status === 401) router.push(loginHref());
      else toast.error(errorMessage(e, t("common.errors.generic")));
    } finally {
      setFavBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href.split("#")[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, text: p.tagline ?? undefined, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    if (await copyText(url)) toast.success(t("catalog.detail.actions.linkCopied"));
  };

  const completed = p.actualEndDate ?? (p.status === "COMPLETED" || p.status === "COMMISSIONED" ? p.plannedEndDate : null);
  const facts: { icon: Icon; label: string; value: string; mono?: boolean }[] = [
    { icon: Building, label: t("catalog.detail.facts.floors"), value: String(p.floors), mono: true },
    { icon: Buildings2, label: t("catalog.detail.facts.sections"), value: String(p.sections ?? 1), mono: true },
    { icon: Ruler, label: t("catalog.detail.facts.totalArea"), value: fmt.area(p.totalArea), mono: true },
    {
      icon: Calendar,
      label: completed ? t("catalog.detail.facts.completed") : t("catalog.detail.facts.completion"),
      value: fmt.monthYear(completed ?? p.plannedEndDate),
    },
    { icon: MoneySend, label: t("catalog.detail.facts.priceFrom"), value: p.priceFrom ? fmt.compactMoney(p.priceFrom, p.currency) : "—", mono: true },
    { icon: Home2, label: t("catalog.detail.facts.pricePerSqm"), value: p.pricePerSqm ? fmt.compactMoney(p.pricePerSqm, p.currency) : "—", mono: true },
  ];

  const dev = p.developer;

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
      <div style={fade(0)} className="eka-settle">
        {images.length ? (
          <Gallery images={images} name={tr(p.name)} seed={p.slug} floors={p.floors} />
        ) : (
          <div>
            <BuildingViewer
              massing={p.massing}
              model3d={p.model3d}
              floors={p.floors}
              progress={p.progress}
              name={p.name}
              variant="compact"
              className="aspect-[16/11] h-auto"
            />
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-400">
              <span className="size-1.5 rounded-full bg-gold-400" />
              {t("catalog.detail.gallery.preview3d")}
            </p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <div style={fade(0.05)} className="eka-in flex flex-wrap items-center gap-2">
          <StatusBadge kind="projectStatus" value={p.status} />
          {p.verificationStatus === "VERIFIED" && (
            <Badge tone="gold">
              <ShieldTick variant="Bold" />
              {t("catalog.detail.verifiedProject")}
            </Badge>
          )}
          <Badge tone="neutral">{label("projectType", p.type)}</Badge>
        </div>

        <h1 style={fade(0.1)} className="eka-in mt-4 font-display text-[2.6rem] font-medium leading-[1.02] text-stone-100 sm:text-5xl xl:text-6xl">
          {tr(p.name)}
        </h1>
        {p.tagline && (
          <p style={fade(0.14)} className="eka-in mt-3 text-base leading-relaxed text-ink-300 md:text-lg">
            {tr(p.tagline)}
          </p>
        )}

        <div style={fade(0.18)} className="eka-in mt-4 flex items-start gap-2 text-sm text-ink-200">
          <Location size={18} variant="Bulk" className="mt-px shrink-0 text-gold-300" />
          <span>{tr(location)}</span>
        </div>

        <div style={fade(0.22)} className="eka-in">
          <Link
            href={`/developers/${dev.id}`}
            className="group mt-5 flex items-center gap-3 rounded-2xl border border-line bg-ink-900/70 p-3 pr-4 transition hover:border-gold-500/30 hover:bg-ink-900"
          >
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-800 font-semibold text-gold-200">
              {dev.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dev.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                initials(dev.name)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wider text-ink-400">{t("catalog.detail.developer")}</span>
              <span className="flex items-center gap-1.5 truncate font-semibold text-stone-100">
                {tr(dev.name)}
                {dev.status === "VERIFIED" && <Verify size={16} variant="Bold" className="shrink-0 text-gold-400" />}
              </span>
            </span>
            {typeof dev.projectsCount === "number" && (
              <span className="hidden text-xs text-ink-400 sm:block">{t("catalog.detail.projectsCount", { count: dev.projectsCount })}</span>
            )}
            <ArrowRight size={18} className="text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-gold-300" />
          </Link>
        </div>

        <dl style={fade(0.26)} className="eka-in mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="bg-ink-900 px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <f.icon size={14} className="text-gold-400" />
                {f.label}
              </dt>
              <dd className={cn("mt-1 truncate text-[15px] font-semibold text-stone-100", f.mono && "font-mono tracking-tight")}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div style={fade(0.3)} className="eka-in mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-ink-400">{t("catalog.detail.facts.progress")}</span>
            <span className="font-mono font-semibold text-gold-200">{p.progress}%</span>
          </div>
          <Progress value={p.progress} className="h-2" />
        </div>

        <div style={fade(0.34)} className="eka-in mt-7 flex flex-wrap items-center gap-3">
          <Button variant="gold" size="lg" className="w-full sm:w-auto" onClick={() => setTab("units", { scroll: true })}>
            <Home2 size={18} variant="Bold" />
            {t("catalog.detail.actions.chooseUnit")}
          </Button>
          {p.packagePrice &&
            (p.viewer.hasAccess ? (
              <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => setTab("drawings", { scroll: true })}>
                <DocumentText size={18} />
                {t("catalog.detail.actions.packageOwned")}
              </Button>
            ) : packagePurchase ? (
              <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                <Link href={`/app/purchases/${packagePurchase.id}`}>
                  <DocumentText size={18} />
                  {t("catalog.detail.actions.packagePending")}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => buy({ kind: "DOCUMENT_PACKAGE" })}>
                <DocumentText size={18} />
                {t("catalog.detail.actions.buyPackage")}
                <span className="hidden font-mono text-xs opacity-80 sm:inline">· {fmt.compactMoney(p.packagePrice, p.currency)}</span>
              </Button>
            ))}
          <div className="flex items-center gap-1.5">
            <Tooltip content={fav ? t("catalog.detail.actions.unfavorite") : t("catalog.detail.actions.favorite")}>
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleFav}
                disabled={favBusy}
                aria-pressed={fav}
                aria-label={fav ? t("catalog.detail.actions.unfavorite") : t("catalog.detail.actions.favorite")}
                className={cn(fav && "border-danger/40 text-danger")}
              >
                <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                  <Heart size={18} variant={fav ? "Bold" : "Linear"} />
                </motion.span>
              </Button>
            </Tooltip>
            <Tooltip content={t("catalog.detail.actions.share")}>
              <Button variant="secondary" size="icon" onClick={share} aria-label={t("catalog.detail.actions.share")}>
                <Share size={18} />
              </Button>
            </Tooltip>
            <Tooltip content={t("catalog.detail.actions.report")}>
              <Button variant="secondary" size="icon" onClick={() => setReport(true)} aria-label={t("catalog.detail.actions.report")}>
                <Flag size={18} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <ReportDialog projectId={p.id} open={report} onOpenChange={setReport} />
    </section>
  );
}
