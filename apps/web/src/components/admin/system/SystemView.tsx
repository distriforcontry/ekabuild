"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Chart2, CloudCross, Cpu, Danger, Flash, Health, InfoCircle, Layer, Refresh, Setting2, TickCircle, Timer1, TrendUp } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { ChartPaletteStyle, chartVar } from "../charts";
import { useFormat } from "../format";
import { Segmented } from "../analytics/ui";
import { ArchitectureMap, EDGE_COLORS, StatusDot } from "./ArchitectureMap";
import { FACTS, FLOW_KEYS, FLOWS, VIEWS, type EdgeKind, type FlowKey, type MapNode, type ViewKey } from "./data";
import { FlowPlayer } from "./FlowPlayer";
import { useHealth, type HealthSample, type NodeStatus } from "./useHealth";

export function SystemView() {
  const { t } = useI18n();
  const [view, setView] = React.useState<ViewKey>("compose");
  const [selected, setSelected] = React.useState<string | null>("nginx");
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [flow, setFlow] = React.useState<FlowKey>("purchase");
  const hc = useHealth(10_000);

  // keep a sensible selection when switching views (nginx ↔ ingress)
  React.useEffect(() => {
    setSelected((s) => {
      if (s && VIEWS[view].nodes.some((n) => n.id === s)) return s;
      return view === "k8s" ? "ingress" : "nginx";
    });
  }, [view]);

  const statusOf = React.useCallback((n: MapNode): NodeStatus => hc.statusOf(n.health), [hc]);
  const panelRef = React.useRef<HTMLDivElement>(null);
  // on click, bring the explanation into view when it sits below the map (< 2xl)
  const select = React.useCallback((id: string) => {
    setSelected(id);
    const el = panelRef.current;
    if (!el || window.matchMedia("(min-width: 1536px)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight - 120) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);
  const activeId = hovered ?? selected;
  const activeNode = VIEWS[view].nodes.find((n) => n.id === activeId) ?? null;

  return (
    <div>
      <ChartPaletteStyle />
      <PageHeader
        eyebrow={t("admin.system.eyebrow")}
        title={t("admin.system.title")}
        description={t("admin.system.description")}
        actions={
          <Segmented
            label={t("admin.system.title")}
            value={view}
            onChange={setView}
            size="md"
            options={[
              { value: "compose", label: t("admin.system.views.compose") },
              { value: "k8s", label: t("admin.system.views.k8s") },
            ]}
          />
        }
      />

      <HealthStrip hc={hc} />

      {/* map full-width; the explanation sits beside it only where the map can stay legible (2xl) */}
      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 md:px-6">
            <p className="text-sm text-ink-300">{t(`admin.system.viewHint.${view}`)}</p>
            <EdgeLegend />
          </div>
          <div className="bg-blueprint p-3 md:p-5">
            <ArchitectureMap
              view={view}
              active={hovered}
              selected={selected}
              onSelect={select}
              onHover={setHovered}
              statusOf={statusOf}
              answered={hc.health?.instance ?? null}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-300 md:px-6">
            {(["up", "down", "unknown"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-2">
                <StatusDot status={s} /> {t(`admin.system.status.${s}`)}
              </span>
            ))}
            <span className="ml-auto hidden text-ink-400 md:inline">{t("admin.system.panel.hint")}</span>
          </div>
        </Card>

        <div ref={panelRef} className="scroll-mt-24">
          <NodePanel node={activeNode} view={view} status={activeNode ? statusOf(activeNode) : "unknown"} answered={hc.health?.instance ?? null} onSelect={setSelected} />
        </div>
      </div>

      <section className="mt-12" aria-labelledby="flows-title">
        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{t("admin.system.flows.eyebrow")}</div>
          <h2 id="flows-title" className="text-xl font-bold tracking-tight text-stone-100 md:text-2xl">
            {t("admin.system.flows.title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-300">{t("admin.system.flows.hint")}</p>
        </div>
        <Tabs value={flow} onValueChange={(v) => setFlow(v as FlowKey)}>
          <TabsList className="w-full justify-start sm:w-auto">
            {FLOW_KEYS.map((k) => {
              const Icon = FLOWS[k].icon;
              return (
                <TabsTrigger key={k} value={k}>
                  <Icon variant={flow === k ? "Bulk" : "Linear"} />
                  {t(`admin.system.flows.${k}.tab`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {FLOW_KEYS.map((k) => (
            <TabsContent key={k} value={k} className="mt-5">
              {flow === k && <FlowPlayer key={k} flow={k} />}
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}

/* ───────────────────────────── Legend ───────────────────────────── */

function EdgeLegend() {
  const { t } = useI18n();
  const kinds: Exclude<EdgeKind, "metrics">[] = ["http", "data", "event", "external"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-ink-300">
          <svg width="22" height="6" aria-hidden>
            <line x1="1" x2="21" y1="3" y2="3" stroke={EDGE_COLORS[k]} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
          </svg>
          {t(`admin.system.legend.${k}`)}
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────────── Live health ───────────────────────────── */

const instanceColor = (() => {
  const seen = new Map<string, number>();
  return (name: string) => {
    if (!seen.has(name)) seen.set(name, seen.size);
    return chartVar(1 + (seen.get(name)! % 5));
  };
})();

function uptimeText(s: number | null) {
  if (s == null) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s % 60)}`;
}

function HealthStrip({ hc }: { hc: ReturnType<typeof useHealth> }) {
  const { t } = useI18n();
  const f = useFormat();
  const { health, overall, history, checking, lastAt, check } = hc;
  const last = history[history.length - 1];
  const tone = overall === "ok" ? "success" : overall === "degraded" ? "warning" : overall === "down" ? "danger" : null;
  const OverallIcon = overall === "ok" ? TickCircle : overall === "degraded" ? Danger : overall === "down" ? CloudCross : Health;
  const deps: { key: "db" | "redis" | "rabbitmq"; icon: typeof Flash; value: string | null }[] = [
    { key: "db", icon: Setting2, value: health?.db ?? null },
    { key: "redis", icon: Flash, value: health?.redis ?? null },
    { key: "rabbitmq", icon: Layer, value: health?.rabbitmq ?? null },
  ];
  const depStatus = (k: "db" | "redis" | "rabbitmq"): NodeStatus => hc.statusOf(k);
  const instances = [...new Set(history.map((h) => h.instance).filter(Boolean) as string[])];

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
        {/* overall */}
        <div className="flex items-center gap-4 bg-ink-900 p-5">
          <span
            className={cn(
              "relative grid size-12 shrink-0 place-items-center rounded-2xl border",
              tone === "success" && "border-success/30 bg-success/10 text-success",
              tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
              tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
              !tone && "border-line bg-ink-800 text-ink-300",
            )}
          >
            <OverallIcon size={24} variant="Bulk" />
            {overall === "ok" && <span className="absolute -right-0.5 -top-0.5"><StatusDot status="up" /></span>}
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("admin.system.health.title")}</div>
            <div className="mt-0.5 text-lg font-semibold text-stone-100" aria-live="polite">
              {overall === "ok" ? t("admin.system.health.ok") : overall === "degraded" ? t("admin.system.health.degraded") : overall === "down" ? t("admin.system.health.down") : t("admin.system.health.checking")}
            </div>
            <div className="mt-0.5 text-xs text-ink-400">{t("admin.system.health.polling")}</div>
          </div>
        </div>

        {/* replica + deps */}
        <div className="grid grid-cols-2 gap-4 bg-ink-900 p-5 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("admin.system.health.answered")}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`${health?.instance ?? "none"}-${lastAt}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 px-2.5 py-1 font-mono text-sm font-semibold text-gold-200"
                >
                  <Cpu size={14} variant="Bulk" /> {health?.instance ?? "—"}
                </motion.span>
              </AnimatePresence>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-300">
                <Timer1 size={13} /> {last ? `${last.ms} ms` : "—"}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-300" title={t("admin.system.health.uptime")}>
                <TrendUp size={13} /> {uptimeText(health?.uptime ?? null)}
              </span>
            </div>
          </div>
          {deps.map((d) => (
            <div key={d.key} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <d.icon size={13} /> {t(`admin.system.health.${d.key}`)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StatusDot status={depStatus(d.key)} />
                <span className="truncate font-mono text-xs text-stone-100">{d.value ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* history */}
        <div className="flex flex-col gap-2 bg-ink-900 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("admin.system.health.history")}</span>
            <Button size="icon-sm" variant="ghost" onClick={check} loading={checking} aria-label={t("admin.system.health.checkNow")}>
              {!checking && <Refresh />}
            </Button>
          </div>
          <HistoryBars history={history} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
            {instances.map((i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: instanceColor(i) }} />
                <span className="font-mono">{i}</span>
              </span>
            ))}
            {lastAt && <span className="ml-auto">{t("admin.system.health.lastCheck", { time: f.time(new Date(lastAt)) })}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HistoryBars({ history }: { history: HealthSample[] }) {
  const max = Math.max(50, ...history.map((h) => h.ms));
  const slots = 24;
  const pad = Math.max(0, slots - history.length);
  return (
    <div className="flex h-12 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: pad }).map((_, i) => (
        <span key={`p${i}`} className="h-1 flex-1 rounded-sm bg-ink-800" />
      ))}
      {history.map((h) => (
        <motion.span
          key={h.at}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: `${Math.max(10, (h.ms / max) * 100)}%`, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 rounded-t-[3px]"
          style={{ background: h.ok ? (h.instance ? instanceColor(h.instance) : "var(--color-ink-500)") : "var(--color-danger)" }}
          title={`${h.instance ?? "—"} · ${h.ms} ms`}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────── Side panel ───────────────────────────── */

function NodePanel({
  node,
  view,
  status,
  answered,
  onSelect,
}: {
  node: MapNode | null;
  view: ViewKey;
  status: NodeStatus;
  answered: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  if (!node)
    return (
      <Card className="grid place-items-center p-8 text-center text-sm text-ink-400">
        <InfoCircle size={28} variant="Bulk" className="mb-2 text-gold-300" />
        {t("admin.system.panel.hint")}
      </Card>
    );
  const info = node.info;
  const Icon = node.icon ?? VIEWS[view].nodes.find((n) => n.info === info && n.icon)?.icon ?? Chart2;
  const { edges, nodes } = VIEWS[view];
  const familyIds = new Set([node.id, ...nodes.filter((n) => n.info === info && n.kind !== "chip").map((n) => n.id)]);
  const links = edges
    .filter((e) => familyIds.has(e.from) || familyIds.has(e.to))
    .map((e) => {
      const outgoing = familyIds.has(e.from);
      const other = nodes.find((n) => n.id === (outgoing ? e.to : e.from))!;
      return { e, outgoing, other };
    })
    .filter((l, i, arr) => arr.findIndex((x) => x.other.info === l.other.info && x.outgoing === l.outgoing) === i);

  return (
    <Card className="2xl:sticky 2xl:top-20 2xl:max-h-[calc(100dvh-6rem)] 2xl:overflow-y-auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${view}-${node.id}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }} className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-200">
              <Icon size={24} variant="Bulk" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold tracking-tight text-stone-100">{t(`admin.system.nodes.${info}.title`)}</h3>
              <p className="truncate font-mono text-xs text-ink-400">
                {/* replicas / pods name themselves; everything else shows the translated subtitle */}
                {(info === "web" || info === "api" || info === "worker") && node.title && node.kind !== "chip"
                  ? `${node.title} · ${node.subtitle ?? ""}`
                  : t(`admin.system.nodes.${info}.subtitle`)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                status === "up" ? "border-success/30 bg-success/10 text-success" : status === "down" ? "border-danger/30 bg-danger/10 text-danger" : "border-line bg-fg/5 text-ink-300",
              )}
            >
              <StatusDot status={status} /> {t(`admin.system.status.${status}`)}
            </span>
            {node.replica && answered === node.replica && (
              <span className="inline-flex items-center rounded-full bg-gold-gradient px-2 py-1 text-[11px] font-bold text-onyx">{t("admin.system.status.answered")}</span>
            )}
          </div>

          <dl className="mt-5 grid gap-4 text-sm lg:grid-cols-3 lg:gap-6 2xl:grid-cols-1 2xl:gap-4">
            {(["role", "scaling", "health"] as const).map((k) => (
              <div key={k}>
                <dt className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{t(`admin.system.panel.${k}`)}</dt>
                <dd className="leading-relaxed text-ink-200">{t(`admin.system.nodes.${info}.${k}`)}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-x-6 lg:grid-cols-2 2xl:grid-cols-1">
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{t("admin.system.panel.facts")}</div>
            <div className="flex flex-wrap gap-1.5">
              {FACTS[info].map((fct) => (
                <span key={fct} className="rounded-md border border-line bg-fg/[0.03] px-2 py-0.5 font-mono text-[11px] text-ink-200">
                  {fct}
                </span>
              ))}
            </div>
          </div>

          {links.length > 0 && (
            <ul className="mt-5 space-y-1 border-t border-line pt-4 lg:border-t-0 lg:pt-0 2xl:border-t 2xl:pt-4">
              {links.map(({ e, outgoing, other }) => (
                <li key={`${e.from}-${e.to}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(other.id)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-gold-400"
                  >
                    <svg width="18" height="6" aria-hidden className={cn(!outgoing && "rotate-180")}>
                      <line x1="1" x2="17" y1="3" y2="3" stroke={EDGE_COLORS[e.kind]} strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
                    </svg>
                    <span className="flex-1 truncate text-ink-200">{t(`admin.system.nodes.${other.info}.title`)}</span>
                    <span className="text-[10px] text-ink-400">{e.kind === "metrics" ? "/metrics" : t(`admin.system.legend.${e.kind}`)}</span>
                    <ArrowRight size={12} className="text-ink-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
