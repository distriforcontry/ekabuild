"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useElementSize } from "../charts";
import { CANVAS, VIEWS, type EdgeKind, type MapEdge, type MapNode, type ViewKey } from "./data";
import type { NodeStatus } from "./useHealth";

type Side = "left" | "right" | "top" | "bottom";
type Pt = { x: number; y: number };

export const EDGE_COLORS: Record<EdgeKind, string> = {
  http: "var(--color-gold-400)",
  data: "var(--chart-2)",
  event: "var(--chart-5)",
  external: "var(--color-ink-300)",
  metrics: "var(--color-ink-400)",
};

const center = (n: MapNode) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

function sidesFor(a: MapNode, b: MapNode): [Side, Side] {
  if (b.x >= a.x + a.w) return ["right", "left"];
  if (b.x + b.w <= a.x) return ["left", "right"];
  return b.y > a.y ? ["bottom", "top"] : ["top", "bottom"];
}

/** Edge endpoints: edges sharing a node side are spread evenly along it, ordered by the far end. */
function layoutEdges(nodes: MapNode[], edges: MapEdge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const attach = new Map<string, { edge: number; end: 0 | 1; other: MapNode }[]>();
  const sides = edges.map((e) => sidesFor(byId.get(e.from)!, byId.get(e.to)!));
  edges.forEach((e, i) => {
    const [sa, sb] = sides[i]!;
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    for (const [node, side, end, other] of [
      [a, sa, 0, b],
      [b, sb, 1, a],
    ] as const) {
      const k = `${node.id}:${side}`;
      if (!attach.has(k)) attach.set(k, []);
      attach.get(k)!.push({ edge: i, end, other });
    }
  });
  const pts: [Pt, Pt][] = edges.map(() => [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  for (const [k, list] of attach) {
    const [id, side] = k.split(":") as [string, Side];
    const n = byId.get(id)!;
    const vertical = side === "left" || side === "right";
    list.sort((p, q) => (vertical ? center(p.other).y - center(q.other).y : center(p.other).x - center(q.other).x));
    list.forEach((p, i) => {
      const f = (i + 1) / (list.length + 1);
      const pt =
        side === "left" ? { x: n.x, y: n.y + n.h * f } : side === "right" ? { x: n.x + n.w, y: n.y + n.h * f } : side === "top" ? { x: n.x + n.w * f, y: n.y } : { x: n.x + n.w * f, y: n.y + n.h };
      pts[p.edge]![p.end] = pt;
    });
  }
  return edges.map((e, i) => {
    const [a, b] = pts[i]!;
    const [sa] = sides[i]!;
    const horizontal = sa === "left" || sa === "right";
    const dx = Math.max(28, Math.abs(b.x - a.x) / 2);
    const dy = Math.max(20, Math.abs(b.y - a.y) / 2);
    const c1 = horizontal ? { x: a.x + (sa === "right" ? dx : -dx), y: a.y } : { x: a.x, y: a.y + (sa === "bottom" ? dy : -dy) };
    const c2 = horizontal ? { x: b.x - (sa === "right" ? dx : -dx), y: b.y } : { x: b.x, y: b.y - (sa === "bottom" ? dy : -dy) };
    const d = `M${a.x},${a.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
    const mid = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };
    return { ...e, d, mid, key: `${e.from}>${e.to}` };
  });
}

export function ArchitectureMap({
  view,
  active,
  selected,
  onSelect,
  onHover,
  statusOf,
  answered,
}: {
  view: ViewKey;
  active: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  statusOf: (n: MapNode) => NodeStatus;
  answered: string | null;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const scale = width ? Math.max(0.62, Math.min(1, width / CANVAS.w)) : 1;
  const { nodes, edges } = VIEWS[view];
  const laid = React.useMemo(() => layoutEdges(nodes, edges), [nodes, edges]);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // a pool and its members count as one endpoint for highlighting
  const family = React.useCallback(
    (id: string) => {
      const n = byId.get(id);
      if (!n) return [id];
      if (n.kind === "pool") return [id, ...nodes.filter((m) => m.kind !== "pool" && m.kind !== "chip" && m.info === n.info && inside(m, n)).map((m) => m.id)];
      const pool = nodes.find((p) => p.kind === "pool" && p.info === n.info && inside(n, p));
      return pool ? [id, pool.id] : [id];
    },
    [byId, nodes],
  );
  const focus = active ? family(active) : null;
  const edgeLit = (e: MapEdge) => !focus || focus.includes(e.from) || focus.includes(e.to);
  const nodeLit = (n: MapNode) =>
    !focus || focus.includes(n.id) || laid.some((e) => (focus.includes(e.from) && family(e.to).includes(n.id)) || (focus.includes(e.to) && family(e.from).includes(n.id)));
  const statusOfId = (id: string): NodeStatus => {
    const n = byId.get(id)!;
    if (n.kind === "pool") {
      const members = nodes.filter((m) => m.kind !== "pool" && m.kind !== "chip" && m.info === n.info && inside(m, n));
      const st = members.map(statusOf);
      return st.includes("down") ? "down" : st.includes("up") ? "up" : "unknown";
    }
    return statusOf(n);
  };

  return (
    <div ref={ref} className="relative overflow-x-auto overflow-y-hidden pb-2" onMouseLeave={() => onHover(null)}>
      <div className="mx-auto" style={{ width: CANVAS.w * scale, height: CANVAS.h * scale }}>
        {/* plain wrapper owns the scale (motion would reset transform-origin) */}
        <div style={{ width: CANVAS.w, height: CANVAS.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            role="group"
            aria-label={t(`admin.system.views.${view}`)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative"
            style={{ width: CANVAS.w, height: CANVAS.h }}
          >
            {/* pools (behind everything) */}
            {nodes
              .filter((n) => n.kind === "pool")
              .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n.id)}
                  onMouseEnter={() => onHover(n.id)}
                  onFocus={() => onHover(n.id)}
                  onBlur={() => onHover(null)}
                  aria-pressed={selected === n.id}
                  aria-label={`${t(`admin.system.pools.${n.poolLabel!}`)} — ${t(`admin.system.nodes.${n.info}.title`)}`}
                  className={cn(
                    "absolute cursor-pointer rounded-[22px] border border-dashed text-left transition duration-300 focus-visible:outline-2 focus-visible:outline-gold-400",
                    focus?.includes(n.id) ? "border-gold-400/60 bg-gold-500/[0.05]" : "border-line-strong bg-fg/[0.015] hover:border-gold-400/40",
                    !nodeLit(n) && "opacity-40",
                  )}
                  style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
                >
                  <span className="absolute left-4 top-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{t(`admin.system.pools.${n.poolLabel!}`)}</span>
                  {n.info === "api" && answered && !nodes.some((m) => m.replica && m.replica === answered) && (
                    <span className="absolute right-2 top-[calc(100%+12px)] whitespace-nowrap rounded-full border border-gold-500/40 bg-ink-900 px-2 py-0.5 font-mono text-[10px] text-gold-200 shadow-card">
                      ↳ {t("admin.system.status.answered")}: {answered}
                    </span>
                  )}
                </button>
              ))}

            {/* connectors */}
            <svg width={CANVAS.w} height={CANVAS.h} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
              <defs>
                {(["http", "data", "event", "external", "metrics", "down"] as const).map((k) => (
                  <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M1,1.5 L8.5,5 L1,8.5" fill="none" stroke={k === "down" ? "var(--color-danger)" : EDGE_COLORS[k]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                ))}
              </defs>
              {laid.map((e, i) => {
                const down = statusOfId(e.from) === "down" || statusOfId(e.to) === "down";
                const lit = edgeLit(e);
                const color = down ? "var(--color-danger)" : EDGE_COLORS[e.kind];
                return (
                  <g key={e.key} style={{ opacity: lit ? 1 : 0.22, transition: "opacity .3s" }}>
                    <motion.path
                      d={e.d}
                      fill="none"
                      stroke={down ? "var(--color-danger)" : "var(--color-line-strong)"}
                      strokeOpacity={down ? 0.5 : 1}
                      strokeWidth={1.5}
                      markerEnd={`url(#arrow-${down ? "down" : e.kind})`}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.25 + i * 0.05, ease: [0.65, 0, 0.35, 1] }}
                    />
                    {e.kind !== "metrics" && (
                      <path
                        d={e.d}
                        fill="none"
                        stroke={color}
                        strokeWidth={lit && focus ? 2.5 : 2}
                        strokeLinecap="round"
                        strokeDasharray={down ? "3 7" : "2 10"}
                        className="eka-flowing"
                        style={{ animation: down ? undefined : `eka-flow ${e.kind === "event" ? 1.6 : e.kind === "external" ? 2 : 1.1}s linear infinite` }}
                      />
                    )}
                    {e.kind === "metrics" && <path d={e.d} fill="none" stroke={color} strokeWidth={1.25} strokeDasharray="1 5" strokeLinecap="round" />}
                  </g>
                );
              })}
            </svg>

            {/* edge labels */}
            {laid
              .filter((e) => e.label)
              .map((e) => (
                <span
                  key={`l-${e.key}`}
                  className={cn(
                    "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-ink-900/95 px-2 py-0.5 font-mono text-[10px] text-ink-300 shadow-card transition-opacity",
                    !edgeLit(e) && "opacity-30",
                  )}
                  style={{ left: e.mid.x, top: e.mid.y }}
                >
                  {t(`admin.system.edges.${e.label!}`)}
                </span>
              ))}

            {/* nodes */}
            {nodes
              .filter((n) => n.kind !== "pool")
              .map((n, i) => (
                <MapNodeCard
                  key={n.id}
                  node={n}
                  index={i}
                  status={statusOfId(n.id)}
                  selected={selected === n.id}
                  lit={nodeLit(n)}
                  answered={Boolean(answered && n.replica === answered)}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              ))}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function inside(n: MapNode, pool: MapNode) {
  return n.x >= pool.x && n.y >= pool.y && n.x + n.w <= pool.x + pool.w && n.y + n.h <= pool.y + pool.h;
}

export function StatusDot({ status, className }: { status: NodeStatus; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden>
      {status === "up" && <span className="absolute inset-0 rounded-full bg-success motion-safe:animate-[eka-ping_1.8s_ease-out_infinite]" />}
      <span
        className={cn(
          "relative size-2.5 rounded-full",
          status === "up" ? "bg-success" : status === "down" ? "bg-danger shadow-[0_0_10px_rgb(229_72_77/0.7)]" : "border-[1.5px] border-ink-400 bg-transparent",
        )}
      />
    </span>
  );
}

function MapNodeCard({
  node: n,
  index,
  status,
  selected,
  lit,
  answered,
  onSelect,
  onHover,
}: {
  node: MapNode;
  index: number;
  status: NodeStatus;
  selected: boolean;
  lit: boolean;
  answered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const title = n.title ?? t(`admin.system.nodes.${n.info}.title`);
  const subtitle = n.subtitle ?? t(`admin.system.nodes.${n.info}.subtitle`);
  const Icon = n.icon;
  const common = {
    type: "button" as const,
    onClick: () => onSelect(n.id),
    onMouseEnter: () => onHover(n.id),
    onFocus: () => onHover(n.id),
    onBlur: () => onHover(null),
    "aria-pressed": selected,
    "aria-label": `${title} — ${subtitle} — ${t(`admin.system.status.${status}`)}`,
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: lit ? 1 : 0.4, scale: 1 },
    transition: { duration: reduce ? 0 : 0.45, delay: reduce ? 0 : Math.min(0.6, (n.x / 1200) * 0.5 + index * 0.01), ease: [0.16, 1, 0.3, 1] as const },
    style: { left: n.x, top: n.y, width: n.w, height: n.h },
  };

  if (n.kind === "chip")
    return (
      <motion.button
        {...common}
        className={cn(
          "absolute z-20 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 font-mono text-[10.5px] font-semibold shadow-card transition-colors focus-visible:outline-2 focus-visible:outline-gold-400",
          selected ? "border-gold-400 bg-gold-gradient text-onyx" : "border-gold-500/40 bg-ink-900 text-gold-200 hover:border-gold-400",
        )}
      >
        {Icon && <Icon size={12} variant="Bold" />}
        {title}
      </motion.button>
    );

  return (
    <motion.button
      {...common}
      className={cn(
        "group absolute z-10 flex cursor-pointer flex-col rounded-2xl border bg-ink-900 p-3 text-left shadow-card transition-[border-color,box-shadow] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
        n.external && "border-dashed",
        selected ? "border-gold-400 shadow-glow" : status === "down" ? "border-danger/60" : "border-line-strong hover:border-gold-400/60",
        answered && !selected && "border-gold-500/70",
      )}
    >
      {answered && <span className="absolute -inset-1 -z-10 rounded-[20px] bg-gold-500/15 blur-md motion-safe:animate-pulse" aria-hidden />}
      <div className="flex w-full items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl border transition",
              selected ? "border-gold-500/50 bg-gold-500/15 text-gold-200" : "border-line bg-ink-800 text-gold-300 group-hover:text-gold-200",
            )}
          >
            <Icon size={18} variant="Bulk" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[13px] font-semibold leading-tight text-stone-100", n.h > 100 ? "line-clamp-2 break-words" : "truncate")}>{title}</span>
          <span className="block truncate font-mono text-[10px] text-ink-400">{subtitle}</span>
        </span>
        <StatusDot status={status} className="self-start" />
      </div>
      {(n.info === "nginx" || n.info === "ingress") && (
        <span className="mt-2.5 flex flex-wrap gap-1">
          {(n.info === "ingress" ? ["TLS", "cert-manager", "HTTP/2"] : ["TLS", "HTTP/2", "gzip", "rate-limit"]).map((c) => (
            <span key={c} className="rounded-md border border-line bg-fg/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] text-ink-300">
              {c}
            </span>
          ))}
        </span>
      )}
      {n.info === "internet" && (
        <span className="mt-2 flex flex-wrap gap-1">
          {["app", "admin", "api"].map((c) => (
            <span key={c} className="rounded-md border border-line bg-fg/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] text-ink-300">
              {c}
            </span>
          ))}
        </span>
      )}
      {n.info === "monitoring" && (
        <span className="mt-2 flex flex-wrap gap-1">
          {["Prometheus", "Grafana", "Loki"].map((c) => (
            <span key={c} className="rounded-md border border-line bg-fg/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] text-ink-300">
              {c}
            </span>
          ))}
        </span>
      )}
      {answered && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-gold-gradient px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-onyx shadow-card">
          {t("admin.system.status.answered")}
        </span>
      )}
    </motion.button>
  );
}
