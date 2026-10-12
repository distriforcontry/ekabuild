"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { PURCHASE_STATUSES } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { ChartTooltipBox, chartVar, useElementSize } from "../charts";
import { useFormat } from "../format";
import type { FlowLink } from "./types";
import { SrTable } from "./ui";

const ORDER = ["CREATED", "DRAFT", "PENDING_SIGNATURES", "PARTIALLY_SIGNED", "SIGNED", "PAID", "COMPLETED", "CANCELLED"];

/** Status colours carry state (and always ship with a text label on the node). */
function nodeColor(id: string) {
  switch (id) {
    case "PAID":
    case "COMPLETED":
      return "var(--color-success)";
    case "CANCELLED":
      return "var(--color-danger)";
    case "SIGNED":
    case "PARTIALLY_SIGNED":
      return chartVar(1);
    case "PENDING_SIGNATURES":
      return "var(--color-gold-400)";
    default:
      return "var(--color-ink-300)";
  }
}

type Node = { id: string; layer: number; value: number; inV: number; outV: number; x: number; y: number; h: number; color: string; label: string };
type Link = FlowLink & { sy: number; ty: number; w: number; key: string };

const H = 320;
const NODE_W = 14;
const GAP = 22;
const PAD_Y = 16;

export function StatusFlow({ links }: { links: FlowLink[] }) {
  const { t, label } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const [ref, { width: measured }] = useElementSize<HTMLDivElement>();
  const width = Math.max(560, measured);
  const [hover, setHover] = React.useState<{ kind: "node" | "link"; id: string } | null>(null);
  const [tip, setTip] = React.useState<{ x: number; y: number; link: Link } | null>(null);
  const uid = React.useId().replace(/:/g, "");

  const nameOf = React.useCallback(
    (id: string) =>
      id === "CREATED"
        ? t("admin.analytics.flow.created")
        : (PURCHASE_STATUSES as readonly string[]).includes(id)
          ? label("purchaseStatus", id)
          : id.charAt(0) + id.slice(1).toLowerCase().replace(/_/g, " "),
    [t, label],
  );

  const layout = React.useMemo(() => {
    const ids = [...new Set(links.flatMap((l) => [l.from, l.to]))];
    const rank = (id: string) => (ORDER.indexOf(id) >= 0 ? ORDER.indexOf(id) : ORDER.length - 1.5);
    // longest-path layering (bounded iterations → safe on cycles)
    const layer = new Map(ids.map((id) => [id, 0]));
    for (let it = 0; it < ids.length; it++) {
      let changed = false;
      for (const l of links) {
        if (rank(l.to) <= rank(l.from) && ORDER.includes(l.to) && ORDER.includes(l.from)) continue; // ignore back edges
        const want = layer.get(l.from)! + 1;
        if (want > layer.get(l.to)!) {
          layer.set(l.to, want);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const maxLayer = Math.max(1, ...layer.values());

    const nodes: Node[] = ids.map((id) => {
      const inV = links.filter((l) => l.to === id).reduce((s, l) => s + l.count, 0);
      const outV = links.filter((l) => l.from === id).reduce((s, l) => s + l.count, 0);
      return { id, layer: layer.get(id)!, value: Math.max(inV, outV), inV, outV, x: 0, y: 0, h: 0, color: nodeColor(id), label: nameOf(id) };
    });
    const columns = Array.from({ length: maxLayer + 1 }, (_, i) => nodes.filter((n) => n.layer === i).sort((a, b) => rank(a.id) - rank(b.id)));
    const ky = Math.min(...columns.filter((c) => c.length).map((c) => (H - PAD_Y * 2 - (c.length - 1) * GAP) / Math.max(1, c.reduce((s, n) => s + n.value, 0))));
    const labelRoom = 150;
    const usable = width - NODE_W - labelRoom;
    for (const col of columns) {
      const total = col.reduce((s, n) => s + Math.max(3, n.value * ky), 0) + (col.length - 1) * GAP;
      let y = (H - total) / 2;
      for (const n of col) {
        n.h = Math.max(3, n.value * ky);
        n.x = (n.layer / maxLayer) * usable;
        n.y = y;
        y += n.h + GAP;
      }
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outOff = new Map<string, number>();
    const inOff = new Map<string, number>();
    const sorted = [...links].sort((a, b) => byId.get(a.to)!.y - byId.get(b.to)!.y || byId.get(a.from)!.y - byId.get(b.from)!.y);
    const placed: Link[] = sorted.map((l) => {
      const s = byId.get(l.from)!;
      const tg = byId.get(l.to)!;
      const w = Math.max(1.5, l.count * ky);
      const so = outOff.get(s.id) ?? 0;
      const to = inOff.get(tg.id) ?? 0;
      outOff.set(s.id, so + w);
      inOff.set(tg.id, to + w);
      return { ...l, w, sy: s.y + so, ty: tg.y + to, key: `${l.from}>${l.to}` };
    });
    return { nodes, links: placed, byId, maxLayer };
  }, [links, width, nameOf]);

  const linkPath = (l: Link) => {
    const s = layout.byId.get(l.from)!;
    const tg = layout.byId.get(l.to)!;
    const x0 = s.x + NODE_W;
    const x1 = tg.x;
    const mx = (x0 + x1) / 2;
    return `M${x0},${l.sy}C${mx},${l.sy} ${mx},${l.ty} ${x1},${l.ty}L${x1},${l.ty + l.w}C${mx},${l.ty + l.w} ${mx},${l.sy + l.w} ${x0},${l.sy + l.w}Z`;
  };
  const centerPath = (l: Link) => {
    const s = layout.byId.get(l.from)!;
    const tg = layout.byId.get(l.to)!;
    const x0 = s.x + NODE_W;
    const x1 = tg.x;
    const mx = (x0 + x1) / 2;
    const a = l.sy + l.w / 2;
    const b = l.ty + l.w / 2;
    return `M${x0},${a}C${mx},${a} ${mx},${b} ${x1},${b}`;
  };

  const isLit = (l: Link) => !hover || (hover.kind === "link" ? hover.id === l.key : hover.id === l.from || hover.id === l.to);
  const nodeLit = (n: Node) =>
    !hover || (hover.kind === "node" ? hover.id === n.id || layout.links.some((l) => (l.from === hover.id && l.to === n.id) || (l.to === hover.id && l.from === n.id)) : hover.id.split(">").includes(n.id));

  return (
    <div>
      <SrTable
        caption={t("admin.analytics.flow.title")}
        head={[t("admin.analytics.flow.from"), t("admin.analytics.flow.to"), t("admin.analytics.flow.count")]}
        rows={links.map((l) => [nameOf(l.from), nameOf(l.to), f.number(l.count)])}
      />
      <div ref={ref} className="relative -mx-1 overflow-x-auto px-1 pb-1" onMouseLeave={() => (setHover(null), setTip(null))}>
        <svg width={width} height={H} role="img" aria-label={t("admin.analytics.flow.title")} className="block overflow-visible">
          <defs>
            {layout.links.map((l) => (
              <linearGradient key={l.key} id={`lg-${uid}-${l.key.replace(/[^a-z0-9]/gi, "")}`} gradientUnits="userSpaceOnUse" x1={layout.byId.get(l.from)!.x + NODE_W} x2={layout.byId.get(l.to)!.x} y1={0} y2={0}>
                <stop offset="0%" stopColor={layout.byId.get(l.from)!.color} />
                <stop offset="100%" stopColor={layout.byId.get(l.to)!.color} />
              </linearGradient>
            ))}
            <clipPath id={`reveal-${uid}`}>
              <motion.rect x={-4} y={-20} height={H + 40} initial={{ width: reduce ? width + 8 : 0 }} animate={{ width: width + 8 }} transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1], delay: 0.15 }} />
            </clipPath>
          </defs>

          <g clipPath={`url(#reveal-${uid})`}>
            {layout.links.map((l) => {
              const grad = `url(#lg-${uid}-${l.key.replace(/[^a-z0-9]/gi, "")})`;
              const lit = isLit(l);
              return (
                <g key={l.key}>
                  <path
                    d={linkPath(l)}
                    fill={grad}
                    opacity={lit ? (hover ? 0.62 : 0.38) : 0.1}
                    className="cursor-pointer transition-opacity duration-300"
                    onMouseEnter={() => setHover({ kind: "link", id: l.key })}
                    onMouseMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setTip({ x: e.clientX - r.left, y: e.clientY - r.top, link: l });
                    }}
                    onMouseLeave={() => (setHover(null), setTip(null))}
                  />
                  {/* flowing particles along the band — direction of travel */}
                  <path
                    d={centerPath(l)}
                    fill="none"
                    stroke={layout.byId.get(l.to)!.color}
                    strokeWidth={Math.min(3, Math.max(1.5, l.w / 4))}
                    strokeLinecap="round"
                    strokeDasharray="1 11"
                    opacity={lit ? 0.85 : 0.15}
                    className="eka-flowing pointer-events-none transition-opacity duration-300"
                    style={{ animation: `eka-flow ${1.1 + (l.w % 5) * 0.12}s linear infinite` }}
                  />
                </g>
              );
            })}
          </g>

          {layout.nodes.map((n, i) => {
            const lit = nodeLit(n);
            return (
              <motion.g
                key={n.id}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: lit ? 1 : 0.35 }}
                transition={{ duration: 0.4, delay: reduce || hover ? 0 : 0.1 + i * 0.06 }}
                tabIndex={0}
                role="img"
                aria-label={`${n.label}: ${t("admin.analytics.flow.inbound")} ${n.inV}, ${t("admin.analytics.flow.outbound")} ${n.outV}`}
                onMouseEnter={() => setHover({ kind: "node", id: n.id })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ kind: "node", id: n.id })}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none [&:focus-visible>rect:first-child]:stroke-[var(--color-gold-400)]"
              >
                <rect x={n.x - 3} y={n.y - 3} width={NODE_W + 6} height={n.h + 6} rx={6} fill="none" stroke="transparent" strokeWidth={2} />
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={4} fill={n.color} />
                <text
                  x={n.x + NODE_W + 10}
                  y={n.y + n.h / 2}
                  dominantBaseline="middle"
                  className="fill-[var(--color-stone-100)] text-[12px] font-semibold"
                  style={{ paintOrder: "stroke", stroke: "var(--color-ink-900)", strokeWidth: 4, strokeLinejoin: "round" }}
                >
                  {n.label}
                  <tspan dx={6} className="fill-[var(--color-ink-300)] font-mono text-[11px] font-medium">
                    {f.number(n.value)}
                  </tspan>
                </text>
              </motion.g>
            );
          })}
        </svg>

        {tip && (
          <div className="pointer-events-none absolute z-10" style={{ left: Math.min(tip.x + 14, width - 220), top: Math.max(0, tip.y - 70) }}>
            <ChartTooltipBox
              title={`${nameOf(tip.link.from)} → ${nameOf(tip.link.to)}`}
              rows={[
                { label: t("admin.analytics.flow.count"), value: f.number(tip.link.count), color: layout.byId.get(tip.link.to)!.color },
                {
                  label: t("admin.analytics.flow.share"),
                  value: `${Math.round((tip.link.count / Math.max(1, layout.byId.get(tip.link.from)!.outV)) * 100)}%`,
                },
              ]}
            />
          </div>
        )}
      </div>
      <div className={cn("mt-3 flex flex-wrap gap-x-4 gap-y-1.5")}>
        {layout.nodes
          .slice()
          .sort((a, b) => a.layer - b.layer)
          .map((n) => (
            <span key={n.id} className="inline-flex items-center gap-1.5 text-xs text-ink-300">
              <span className="size-2.5 rounded-[3px]" style={{ background: n.color }} />
              {n.label}
            </span>
          ))}
      </div>
    </div>
  );
}
