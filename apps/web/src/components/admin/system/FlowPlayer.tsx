"use client";
import * as React from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowLeft2, ArrowRight2, Pause, Play, RepeatCircle, TickCircle } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useElementSize } from "../charts";
import { ACTOR_ICONS, FLOWS, type FlowKey } from "./data";

type StepText = { label: string; title: string; text: string };

const ROW = 52;
const TOP = 30;
const STEP_MS = 2900;

export function FlowPlayer({ flow }: { flow: FlowKey }) {
  const { t, raw } = useI18n();
  const reduce = useReducedMotion();
  const def = FLOWS[flow];
  const texts = raw<StepText[]>(`admin.system.flows.${flow}.steps`) ?? [];
  const steps = def.steps.map((s, i) => ({ from: s[0], to: s[1], variant: s[2], ...(texts[i] ?? { label: "", title: "", text: "" }) }));
  const n = steps.length;

  const [cur, setCur] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const started = React.useRef(false);

  // autoplay the first time the player scrolls into view (never with reduced motion)
  React.useEffect(() => {
    if (inView && !started.current) {
      started.current = true;
      if (!reduce) setPlaying(true);
    }
  }, [inView, reduce]);

  React.useEffect(() => {
    if (!playing) return;
    if (cur >= n - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setCur((c) => Math.min(n - 1, c + 1)), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, cur, n]);

  const go = (i: number) => setCur(Math.max(0, Math.min(n - 1, i)));
  const toggle = () => {
    if (!playing && cur >= n - 1) setCur(0);
    setPlaying((p) => !p);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") (e.preventDefault(), setPlaying(false), go(cur + 1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), setPlaying(false), go(cur - 1));
    else if (e.key === " ") (e.preventDefault(), toggle());
  };

  const active = steps[cur]!;

  return (
    <div ref={rootRef} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="min-w-0 rounded-2xl border border-line bg-ink-900/80 shadow-card">
        <div className="border-b border-line p-5 md:p-6">
          <h3 className="text-base font-semibold text-stone-100">{t(`admin.system.flows.${flow}.title`)}</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-300">{t(`admin.system.flows.${flow}.summary`)}</p>
          {/* controls */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="gold" onClick={toggle} aria-label={playing ? t("admin.system.flows.pause") : t("admin.system.flows.play")}>
              {playing ? <Pause variant="Bold" /> : <Play variant="Bold" />}
              <span className="hidden sm:inline">{playing ? t("admin.system.flows.pause") : t("admin.system.flows.play")}</span>
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={() => (setPlaying(false), go(cur - 1))} disabled={cur === 0} aria-label={t("admin.system.flows.prev")}>
              <ArrowLeft2 />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={() => (setPlaying(false), go(cur + 1))} disabled={cur === n - 1} aria-label={t("admin.system.flows.next")}>
              <ArrowRight2 />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => (setCur(0), setPlaying(!reduce))} aria-label={t("admin.system.flows.restart")}>
              <RepeatCircle />
            </Button>
            <span className="ml-1 font-mono text-xs text-ink-300">{t("admin.system.flows.step", { n: cur + 1, total: n })}</span>
            <div className="ml-auto hidden gap-1 sm:flex" role="group" aria-label={t("admin.system.flows.title")}>
              {steps.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => (setPlaying(false), go(i))}
                  aria-label={`${i + 1}. ${s.title}`}
                  aria-current={i === cur ? "step" : undefined}
                  className="group grid h-6 cursor-pointer place-items-center px-0.5 focus-visible:outline-2 focus-visible:outline-gold-400"
                >
                  <span className={cn("block h-1.5 w-6 overflow-hidden rounded-full bg-ink-700 transition", i < cur && "bg-gold-500/70")}>
                    {i === cur && (
                      <motion.span
                        key={`${cur}-${playing}`}
                        className="block h-full rounded-full bg-gold-400"
                        initial={{ width: playing && !reduce ? "0%" : "100%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: playing && !reduce ? STEP_MS / 1000 : 0, ease: "linear" }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* sequence diagram */}
        <div
          tabIndex={0}
          onKeyDown={onKey}
          aria-label={`${t(`admin.system.flows.${flow}.title`)} — ${t("admin.system.flows.keyboard")}`}
          className="overflow-x-auto rounded-b-2xl p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-400 md:p-6"
        >
          <Sequence flow={flow} steps={steps} cur={cur} onPick={(i) => (setPlaying(false), go(i))} />
        </div>
        <p className="px-6 pb-4 text-[11px] text-ink-500">{t("admin.system.flows.keyboard")}</p>
        <div className="sr-only" aria-live="polite">
          {cur + 1}. {active.title}. {active.text}
        </div>
      </div>

      {/* step list */}
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const state = i < cur ? "done" : i === cur ? "current" : "todo";
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => (setPlaying(false), go(i))}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border p-3.5 text-left transition duration-300 focus-visible:outline-2 focus-visible:outline-gold-400",
                  state === "current" ? "border-gold-500/40 bg-gradient-to-br from-gold-500/[0.09] to-transparent shadow-card" : "border-transparent hover:bg-fg/[0.04]",
                )}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold transition",
                      state === "current" && (s.variant === "error" ? "border border-danger/50 bg-danger/15 text-danger" : "bg-gold-gradient text-onyx"),
                      state === "done" && "border border-gold-500/50 text-gold-300",
                      state === "todo" && "border border-line-strong text-ink-400",
                    )}
                  >
                    {state === "done" ? <TickCircle size={14} variant="Bold" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", state === "todo" ? "text-ink-300" : "text-stone-100")}>{s.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-400">{s.label}</span>
                    <AnimatePresence initial={false}>
                      {state === "current" && (
                        <motion.span
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="block overflow-hidden"
                        >
                          <span className="block pt-2 text-[13px] leading-relaxed text-ink-200">{s.text}</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Sequence({
  flow,
  steps,
  cur,
  onPick,
}: {
  flow: FlowKey;
  steps: { from: string; to: string; variant?: "async" | "error"; label: string; title: string }[];
  cur: number;
  onPick: (i: number) => void;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const actors = FLOWS[flow].actors;
  const n = actors.length;
  const minW = n * 104;
  const [ref, { width: measured }] = useElementSize<HTMLDivElement>();
  const W = Math.max(minW, measured);
  const colW = W / n;
  const cx = (a: string) => (actors.indexOf(a as (typeof actors)[number]) + 0.5) * colW;
  const H = TOP + steps.length * ROW;
  const active = steps[cur]!;

  return (
    <div ref={ref} style={{ minWidth: minW }}>
      {/* actor headers */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {actors.map((a) => {
          const Icon = ACTOR_ICONS[a];
          const involved = active.from === a || active.to === a;
          return (
            <div key={a} className="flex flex-col items-center gap-1.5 px-1 text-center">
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-2xl border transition duration-300",
                  involved ? "border-gold-400/70 bg-gold-500/15 text-gold-200 shadow-glow" : "border-line-strong bg-ink-800 text-ink-300",
                )}
              >
                <Icon size={20} variant="Bulk" />
              </span>
              <span className={cn("max-w-full truncate text-[11px] font-semibold transition", involved ? "text-stone-100" : "text-ink-400")}>{t(`admin.system.flows.actors.${a}`)}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-2" style={{ height: H }}>
        <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
          {/* lifelines */}
          {actors.map((a) => {
            const involved = active.from === a || active.to === a;
            return <line key={a} x1={cx(a)} x2={cx(a)} y1={0} y2={H} stroke={involved ? "var(--color-gold-500)" : "var(--color-line-strong)"} strokeOpacity={involved ? 0.5 : 1} strokeWidth={involved ? 1.5 : 1} />;
          })}
          {steps.map((s, i) => {
            const y = TOP + i * ROW;
            const dir = Math.sign(cx(s.to) - cx(s.from)) || 1;
            const x1 = cx(s.from) + dir * 13;
            const x2 = cx(s.to) - dir * 4;
            const state = i < cur ? "done" : i === cur ? "current" : "todo";
            const color =
              state === "todo" ? "var(--color-ink-500)" : s.variant === "error" ? "var(--color-danger)" : state === "current" ? "var(--color-gold-400)" : "var(--color-gold-600)";
            return (
              <g key={i} onClick={() => onPick(i)} className="cursor-pointer" style={{ opacity: state === "todo" ? 0.4 : 1, transition: "opacity .4s" }}>
                {/* generous hit area */}
                <rect x={Math.min(x1, x2) - 14} y={y - 22} width={Math.abs(x2 - x1) + 28} height={36} fill="transparent" />
                <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={state === "current" ? 2.5 : 1.75} strokeLinecap="round" strokeDasharray={s.variant === "async" ? "6 5" : undefined} />
                <path d={`M${x2 - dir * 9},${y - 5} L${x2},${y} L${x2 - dir * 9},${y + 5}`} fill="none" stroke={color} strokeWidth={state === "current" ? 2.5 : 1.75} strokeLinecap="round" strokeLinejoin="round" />
                {state === "current" && (
                  <motion.circle
                    key={`dot-${cur}`}
                    r={4.5}
                    cy={y}
                    fill={color}
                    initial={{ cx: x1, opacity: 0 }}
                    animate={reduce ? { cx: x2, opacity: 0 } : { cx: [x1, x2], opacity: [0, 1, 1, 0] }}
                    transition={reduce ? { duration: 0 } : { duration: 1.2, repeat: Infinity, repeatDelay: 0.35, ease: "easeInOut" }}
                  />
                )}
                {state === "current" && <circle cx={cx(s.from)} cy={y} r={15} fill={color} opacity={0.18} className="motion-safe:animate-pulse" />}
                <circle cx={cx(s.from)} cy={y} r={10.5} fill={state === "todo" ? "var(--color-ink-800)" : color} stroke="var(--color-ink-900)" strokeWidth={2} />
                <text
                  x={cx(s.from)}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-[10px] font-bold"
                  fill={state === "todo" ? "var(--color-ink-300)" : s.variant === "error" ? "#fff" : "var(--color-onyx)"}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        {/* step labels (HTML so they truncate cleanly) */}
        {steps.map((s, i) => {
          const y = TOP + i * ROW;
          const a = cx(s.from);
          const b = cx(s.to);
          const left = Math.min(a, b) + 16;
          const width = Math.abs(b - a) - 24;
          const state = i < cur ? "done" : i === cur ? "current" : "todo";
          return (
            <span
              key={i}
              className={cn(
                "pointer-events-none absolute truncate text-center font-mono text-[10.5px] transition-colors duration-300",
                state === "current" ? (s.variant === "error" ? "font-semibold text-danger" : "font-semibold text-stone-100") : state === "done" ? "text-ink-300" : "text-ink-500",
              )}
              style={{ left, width: Math.max(40, width), top: y - 19 }}
              title={s.label}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
