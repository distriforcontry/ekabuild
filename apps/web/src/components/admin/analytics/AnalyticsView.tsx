"use client";
import * as React from "react";
import { flushSync } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Clock, Data, Hierarchy, Map1, PenTool, Printer, Ranking, Refresh, Building4, Messages2, Home2, ShieldTick } from "iconsax-reactjs";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { ChartPaletteStyle } from "../charts";
import { useFormat } from "../format";
import { useApi } from "../hooks";
import { ErrorNotice } from "../primitives";
import { DailyTrends } from "./DailyTrends";
import { Funnel } from "./Funnel";
import { HourlyHeatmap } from "./HourlyHeatmap";
import { KpiGrid } from "./KpiGrid";
import { DeveloperLeaderboard, TopProjectsTable } from "./Leaderboards";
import { Regions, RegionsMetricSwitch, RegionsTable, type RegionMetric } from "./Regions";
import { SignaturesDonut, SupportKpi } from "./SignaturesSupport";
import { StatusFlow } from "./StatusFlow";
import { TrustScatter } from "./TrustScatter";
import { normalizeAnalytics, PERIODS, type Period } from "./types";
import { ChartSkeleton, Dimmed, NoData, Panel, Segmented } from "./ui";
import { UnitMix } from "./UnitMix";

const DEFAULT_PERIOD: Period = 30;
const PRINT_WIDTH = 700; // A4 portrait printable width (12 mm margins) in CSS px

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body, .min-h-dvh { background: #fff !important; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header, aside, [data-sonner-toaster] { display: none !important; }
  main { padding: 0 !important; max-width: none !important; }
  #analytics-report { width: ${PRINT_WIDTH}px !important; margin: 0 auto !important; }
}
html.eka-printing *, html.eka-printing *::before, html.eka-printing *::after { transition: none !important; }
`;

export function AnalyticsView() {
  const { t } = useI18n();
  const f = useFormat();
  const sp = useSearchParams();
  const pathname = usePathname();
  const raw = Number(sp.get("days"));
  const days: Period = (PERIODS as readonly number[]).includes(raw) ? (raw as Period) : DEFAULT_PERIOD;

  const setDays = (d: Period) => {
    const next = new URLSearchParams(window.location.search);
    if (d === DEFAULT_PERIOD) next.delete("days");
    else next.set("days", String(d));
    const qs = next.toString();
    window.history.replaceState(window.history.state, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  const { data: rawData, loading, error, reload } = useApi<unknown>("/admin/analytics", { days });
  const data = React.useMemo(() => (rawData ? normalizeAnalytics(rawData, days) : null), [rawData, days]);
  const refreshing = loading && Boolean(data);
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);
  React.useEffect(() => {
    if (rawData) setLoadedAt(new Date());
  }, [rawData]);

  const [metric, setMetric] = React.useState<RegionMetric>("revenue");
  // client-only timestamp for the report header (a server-rendered "now" would not hydrate)
  const [generatedAt, setGeneratedAt] = React.useState<Date | null>(null);
  React.useEffect(() => setGeneratedAt(new Date()), []);

  // ── "Hisobot": light theme + single-column fixed-width layout, so charts re-measure before the browser paginates
  const [printing, setPrinting] = React.useState(false);
  const startReport = React.useCallback(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute("data-theme");
    flushSync(() => {
      setGeneratedAt(new Date());
      setPrinting(true);
    });
    html.classList.add("eka-printing");
    html.setAttribute("data-theme", "light");
    const restore = () => {
      window.removeEventListener("afterprint", restore);
      if (prevTheme) html.setAttribute("data-theme", prevTheme);
      html.classList.remove("eka-printing");
      setPrinting(false);
    };
    window.addEventListener("afterprint", restore);
    // let ResizeObserver + recharts lay out at print width first
    window.setTimeout(() => window.print(), 700);
  }, []);

  const periodLabel = (p: Period) => t(`admin.analytics.periods.d${p}`);
  const span = (wide: string) => (printing ? "" : wide);
  const empty = (n: number) => data && n === 0;

  return (
    <div id="analytics-report" className={cn(printing && "mx-auto")} style={printing ? { width: PRINT_WIDTH } : undefined}>
      <ChartPaletteStyle />
      <style>{PRINT_CSS}</style>

      {/* print-only report header */}
      <div className={cn("mb-6 items-center justify-between border-b border-line pb-4", printing ? "flex" : "hidden print:flex")}>
        <Logo className="h-9" />
        <div className="text-right">
          <div className="text-lg font-semibold text-stone-100">{t("admin.analytics.reportTitle")}</div>
          {data && (
            <div className="text-xs text-ink-300">
              {t("admin.analytics.reportPeriod", { from: f.date(data.range.from || null), to: f.date(data.range.to || null), days: data.range.days })}
            </div>
          )}
          {generatedAt && <div className="text-[11px] text-ink-400">{t("admin.analytics.generated", { date: f.dateTime(generatedAt) })}</div>}
        </div>
      </div>

      <PageHeader
        className="print:hidden"
        eyebrow={t("admin.analytics.eyebrow")}
        title={t("admin.analytics.title")}
        description={t("admin.analytics.description")}
        actions={
          <>
            <Segmented label={t("admin.analytics.period")} value={days} onChange={setDays} size="md" options={PERIODS.map((p) => ({ value: p, label: periodLabel(p) }))} />
            <Button variant="secondary" size="sm" onClick={reload} loading={refreshing} aria-label={t("admin.common.refresh")}>
              {!refreshing && <Refresh />}
              <span className="hidden sm:inline">{t("admin.common.refresh")}</span>
            </Button>
            <Button variant="gold" size="sm" onClick={startReport} disabled={!data}>
              <Printer /> {t("admin.analytics.report")}
            </Button>
          </>
        }
      />

      {data && (
        <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400 print:hidden">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-900 px-2.5 py-1 font-mono text-ink-200">
            <Clock size={12} className="text-gold-300" />
            {f.date(data.range.from || null)} — {f.date(data.range.to || null)}
          </span>
          <span>{t("admin.analytics.vsPrev")}</span>
          {loadedAt && <span className="ml-auto">{t("admin.common.updatedAt", { time: f.time(loadedAt) })}</span>}
        </div>
      )}

      <ErrorNotice error={error} onRetry={reload} />

      <KpiGrid data={data} loading={refreshing} error={Boolean(error)} />

      <div className={cn("mt-4 grid grid-cols-1 gap-4", !printing && "xl:grid-cols-5")}>
        <Panel title={t("admin.analytics.trends.title")} hint={t("admin.analytics.trends.hint")} icon={Activity} className={span("xl:col-span-5")}>
          {!data ? <ChartSkeleton height={520} dim={Boolean(error)} /> : empty(data.daily.length) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <DailyTrends data={data.daily} days={data.range.days} />
            </Dimmed>
          )}
        </Panel>

        <Panel title={t("admin.analytics.funnel.title")} hint={t("admin.analytics.funnel.hint")} icon={Data} className={span("xl:col-span-3")}>
          {!data ? <ChartSkeleton height={300} dim={Boolean(error)} /> : data.funnel.every((s) => !s.count) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <Funnel data={data.funnel} />
            </Dimmed>
          )}
        </Panel>

        <Panel title={t("admin.analytics.signatures.title")} hint={t("admin.analytics.signatures.hint")} icon={PenTool} className={span("xl:col-span-2")}>
          {!data ? <ChartSkeleton height={180} kind="ring" dim={Boolean(error)} /> : (
            <Dimmed active={refreshing}>
              <SignaturesDonut data={data.signatures} />
            </Dimmed>
          )}
        </Panel>

        <Panel title={t("admin.analytics.flow.title")} hint={t("admin.analytics.flow.hint")} icon={Hierarchy} className={span("xl:col-span-3")}>
          {!data ? <ChartSkeleton height={320} dim={Boolean(error)} /> : empty(data.statusFlow.length) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <StatusFlow links={data.statusFlow} />
            </Dimmed>
          )}
        </Panel>

        <Panel title={t("admin.analytics.support.title")} hint={t("admin.analytics.support.hint")} icon={Messages2} className={span("xl:col-span-2")}>
          {!data ? <ChartSkeleton height={260} kind="rows" dim={Boolean(error)} /> : (
            <Dimmed active={refreshing}>
              <SupportKpi data={data.support} />
            </Dimmed>
          )}
        </Panel>

        <Panel
          title={t("admin.analytics.regions.title")}
          hint={t("admin.analytics.regions.hint")}
          icon={Map1}
          className={span("xl:col-span-5")}
          contentClassName="px-0 pb-0 md:px-0 md:pb-0"
          actions={<RegionsMetricSwitch value={metric} onChange={setMetric} />}
        >
          <div className="px-5 pb-6 md:px-6">
            {!data ? <ChartSkeleton height={260} dim={Boolean(error)} /> : empty(data.byRegion.length) ? <NoData /> : (
              <Dimmed active={refreshing}>
                <Regions rows={data.byRegion} metric={metric} />
              </Dimmed>
            )}
          </div>
          {data && data.byRegion.length > 0 && <RegionsTable rows={data.byRegion} />}
        </Panel>

        <Panel
          title={t("admin.analytics.developers.title")}
          hint={t("admin.analytics.developers.hint")}
          icon={Ranking}
          className={span("xl:col-span-3")}
          contentClassName="px-0 pb-0 md:px-0 md:pb-0"
        >
          {!data ? (
            <div className="px-5 pb-6 md:px-6">
              <ChartSkeleton height={280} kind="rows" dim={Boolean(error)} />
            </div>
          ) : (
            <DeveloperLeaderboard rows={data.byDeveloper} />
          )}
        </Panel>

        <Panel title={t("admin.analytics.scatter.title")} hint={t("admin.analytics.scatter.hint")} icon={ShieldTick} className={span("xl:col-span-2")}>
          {!data ? <ChartSkeleton height={300} dim={Boolean(error)} /> : empty(data.trustVsSales.length) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <TrustScatter points={data.trustVsSales} />
            </Dimmed>
          )}
        </Panel>

        <Panel
          title={t("admin.analytics.projects.title")}
          hint={t("admin.analytics.projects.hint")}
          icon={Building4}
          className={span("xl:col-span-3")}
          contentClassName="px-0 pb-0 md:px-0 md:pb-0"
        >
          {!data ? (
            <div className="px-5 pb-6 md:px-6">
              <ChartSkeleton height={280} kind="rows" dim={Boolean(error)} />
            </div>
          ) : (
            <TopProjectsTable rows={data.topProjects} />
          )}
        </Panel>

        <Panel title={t("admin.analytics.units.title")} hint={t("admin.analytics.units.hint")} icon={Home2} className={span("xl:col-span-2")}>
          {!data ? <ChartSkeleton height={260} kind="rows" dim={Boolean(error)} /> : empty(data.unitMix.length) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <UnitMix rows={data.unitMix} />
            </Dimmed>
          )}
        </Panel>

        <Panel title={t("admin.analytics.hourly.title")} hint={t("admin.analytics.hourly.hint")} icon={Clock} className={span("xl:col-span-5")}>
          {!data ? <ChartSkeleton height={120} dim={Boolean(error)} /> : data.hourly.every((h) => !h.views && !h.purchases) ? <NoData /> : (
            <Dimmed active={refreshing}>
              <HourlyHeatmap data={data.hourly} />
            </Dimmed>
          )}
        </Panel>
      </div>
    </div>
  );
}
