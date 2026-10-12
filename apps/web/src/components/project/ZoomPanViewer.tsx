"use client";
import * as React from "react";
import { MaximizeCircle, SearchZoomIn, SearchZoomOut } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";

type View = { s: number; x: number; y: number };
const MIN = 0.5;
const MAX = 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pan / zoom image viewer for drawings: wheel zoom at cursor, drag, pinch, double-click, keyboard (+ − 0). */
export function ZoomPanViewer({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { t } = useI18n();
  const box = React.useRef<HTMLDivElement>(null);
  const [view, setView] = React.useState<View>({ s: 1, x: 0, y: 0 });
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const pinch = React.useRef<{ d: number; s: number } | null>(null);
  const viewRef = React.useRef(view);
  viewRef.current = view;

  /** zoom to scale s2 keeping the container point (px, py) fixed */
  const zoomAt = React.useCallback((s2: number, px: number, py: number) => {
    setView((v) => {
      const s = clamp(s2, MIN, MAX);
      const lx = (px - v.x) / v.s;
      const ly = (py - v.y) / v.s;
      return { s, x: px - s * lx, y: py - s * ly };
    });
  }, []);

  const center = () => {
    const r = box.current?.getBoundingClientRect();
    return r ? { x: r.width / 2, y: r.height / 2 } : { x: 0, y: 0 };
  };
  const fit = () => setView({ s: 1, x: 0, y: 0 });
  const step = (f: number) => {
    const c = center();
    zoomAt(viewRef.current.s * f, c.x, c.y);
  };

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(viewRef.current.s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const local = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), s: viewRef.current.s };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomAt((pinch.current.s * d) / Math.max(1, pinch.current.d), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
    } else if (pointers.current.size === 1) {
      setView((v) => ({ ...v, x: v.x + p.x - prev.x, y: v.y + p.y - prev.y }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  return (
    <div className={cn("relative size-full overflow-hidden rounded-2xl bg-ink-850", className)}>
      <div
        ref={box}
        tabIndex={0}
        role="img"
        aria-label={alt}
        className={cn("bg-blueprint absolute inset-0 touch-none outline-none", dragging ? "cursor-grabbing" : "cursor-grab")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const r = box.current!.getBoundingClientRect();
          if (viewRef.current.s > 1.2) fit();
          else zoomAt(2.5, e.clientX - r.left, e.clientY - r.top);
        }}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") step(1.25);
          else if (e.key === "-") step(0.8);
          else if (e.key === "0") fit();
          else if (e.key.startsWith("Arrow")) {
            const d = 40;
            setView((v) => ({
              ...v,
              x: v.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0),
              y: v.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0),
            }));
          }
        }}
      >
        <div
          className="absolute inset-0 flex origin-top-left items-center justify-center p-4 will-change-transform"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
            transition: dragging ? "none" : "transform .18s cubic-bezier(.16,1,.3,1)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn("max-h-full max-w-full select-none rounded-md object-contain shadow-lift transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
          />
        </div>
        {!loaded && !failed && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner className="size-6 text-gold-400" />
          </div>
        )}
        {failed && <div className="absolute inset-0 grid place-items-center text-sm text-ink-400">{t("catalog.error.title")}</div>}
      </div>

      <div className="glass absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1 shadow-card">
        <Tooltip content={t("catalog.zoom.zoomOut")}>
          <button type="button" onClick={() => step(0.8)} aria-label={t("catalog.zoom.zoomOut")} className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-100 transition hover:bg-fg/10">
            <SearchZoomOut size={18} />
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => {
            const c = center();
            zoomAt(1, c.x, c.y);
          }}
          className="h-9 min-w-16 cursor-pointer rounded-xl px-2 font-mono text-xs text-ink-100 transition hover:bg-fg/10"
          title={t("catalog.zoom.actual")}
        >
          {Math.round(view.s * 100)}%
        </button>
        <Tooltip content={t("catalog.zoom.zoomIn")}>
          <button type="button" onClick={() => step(1.25)} aria-label={t("catalog.zoom.zoomIn")} className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-100 transition hover:bg-fg/10">
            <SearchZoomIn size={18} />
          </button>
        </Tooltip>
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Tooltip content={t("catalog.zoom.fit")}>
          <button type="button" onClick={fit} aria-label={t("catalog.zoom.fit")} className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-100 transition hover:bg-fg/10">
            <MaximizeCircle size={18} />
          </button>
        </Tooltip>
      </div>
      <p className="pointer-events-none absolute left-3 top-3 hidden rounded-lg bg-ink-950/60 px-2 py-1 text-[11px] text-ink-300 backdrop-blur md:block">
        {t("catalog.zoom.hint")}
      </p>
    </div>
  );
}
