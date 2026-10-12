"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CloseCircle, Element3, Grid5, Home2, RowVertical, ShoppingCart, TickCircle } from "iconsax-reactjs";
import { UNIT_STATUSES, type UnitStatus } from "@eka/shared";
import type { UnitItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { EmptyState, InfoRow } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorCard } from "@/components/catalog/states";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "../ProjectProvider";
import { Sheet } from "../Sheet";
import { Lightbox } from "../Lightbox";

const CELL: Record<UnitStatus, string> = {
  AVAILABLE: "border-success/35 bg-success/12 text-success hover:border-success/70 hover:bg-success/22",
  RESERVED: "border-warning/35 bg-warning/12 text-warning hover:border-warning/70 hover:bg-warning/20",
  SOLD: "border-line bg-fg/[0.03] text-ink-400 hover:bg-fg/6",
};
const DOT: Record<UnitStatus, string> = { AVAILABLE: "bg-success", RESERVED: "bg-warning", SOLD: "bg-ink-500" };

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
};

type Filters = { rooms: string | null; status: string | null; pMin: string; pMax: string; aMin: string; aMax: string };
const EMPTY: Filters = { rooms: null, status: null, pMin: "", pMax: "", aMin: "", aMax: "" };

export function UnitsTab() {
  const { units, loadUnits, purchaseForUnit } = useProject();
  const { t, label } = useI18n();
  const [view, setView] = React.useState<"chess" | "list">("chess");
  const [section, setSection] = React.useState<number | null>(null);
  const [f, setF] = React.useState<Filters>(EMPTY);
  const [selected, setSelected] = React.useState<UnitItem | null>(null);

  React.useEffect(() => loadUnits(), [loadUnits]);

  const items = units.items;
  const sections = React.useMemo(() => [...new Set(items.map((u) => u.section))].sort((a, b) => a - b), [items]);
  const activeSection = section ?? sections[0] ?? 1;
  const roomsOptions = React.useMemo(
    () => [...new Set(items.map((u) => u.rooms))].sort((a, b) => a - b).map((r) => ({ value: String(r), label: t("catalog.units.roomsN", { n: r }) })),
    [items, t],
  );

  const match = React.useCallback(
    (u: UnitItem) => {
      if (f.rooms && String(u.rooms) !== f.rooms) return false;
      if (f.status && u.status !== f.status) return false;
      const price = Number(u.price) / 1e6;
      const pMin = num(f.pMin);
      const pMax = num(f.pMax);
      const aMin = num(f.aMin);
      const aMax = num(f.aMax);
      if (pMin !== null && price < pMin) return false;
      if (pMax !== null && price > pMax) return false;
      if (aMin !== null && u.area < aMin) return false;
      if (aMax !== null && u.area > aMax) return false;
      return true;
    },
    [f],
  );
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const matched = items.filter(match);
  const counts = UNIT_STATUSES.reduce((acc, s) => ({ ...acc, [s]: items.filter((u) => u.status === s).length }), {} as Record<UnitStatus, number>);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h3 className="font-display text-3xl text-stone-100">{t("catalog.units.title")}</h3>
        <p className="mt-1 text-sm text-ink-400">{t("catalog.units.subtitle")}</p>
      </div>
      <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-ink-900 p-1">
        {(
          [
            ["chess", Element3, t("catalog.units.chess")],
            ["list", RowVertical, t("catalog.units.list")],
          ] as const
        ).map(([v, I, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            onClick={() => setView(v)}
            className={cn("relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors", view === v ? "text-onyx" : "text-ink-300 hover:text-stone-100")}
          >
            {view === v && <motion.span layoutId="units-view-pill" className="absolute inset-0 rounded-lg bg-gold-gradient shadow-glow" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <I size={16} variant={view === v ? "Bold" : "Linear"} className="relative" />
            <span className="relative">{l}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (units.status === "idle" || (units.status === "loading" && !items.length)) {
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-3xl border border-line bg-ink-900/80 p-5">
          <Skeleton className="mb-5 h-11 w-full rounded-xl" />
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="mb-2 flex gap-2">
              <Skeleton className="h-14 w-12" />
              {Array.from({ length: 6 }).map((__, c) => (
                <Skeleton key={c} className="h-14 w-[72px] rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (units.status === "error" && !items.length) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorCard title={t("catalog.units.error")} />
        <div className="text-center">
          <Button variant="outline" onClick={() => loadUnits(true)}>
            {t("catalog.error.retry")}
          </Button>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState icon={Grid5} title={t("catalog.units.empty")} description={t("catalog.units.emptyHint")} className="py-20" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {/* filters */}
      <div className="rounded-3xl border border-line bg-ink-900/80 p-4 shadow-card md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-300">{t("catalog.units.rooms")}</div>
            <Combobox
              aria-label={t("catalog.units.rooms")}
              options={roomsOptions}
              value={f.rooms}
              onChange={(v) => setF((s) => ({ ...s, rooms: v }))}
              placeholder={t("catalog.units.anyRooms")}
              searchable={false}
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-300">{t("catalog.units.status")}</div>
            <Combobox
              aria-label={t("catalog.units.status")}
              options={UNIT_STATUSES.map((s) => ({ value: s, label: label("unitStatus", s), icon: <span className={cn("size-2 rounded-full", DOT[s])} /> }))}
              value={f.status}
              onChange={(v) => setF((s) => ({ ...s, status: v }))}
              placeholder={t("catalog.units.anyStatus")}
              searchable={false}
            />
          </div>
          <RangeInputs
            label={t("catalog.units.priceRange")}
            min={f.pMin}
            max={f.pMax}
            onMin={(v) => setF((s) => ({ ...s, pMin: v }))}
            onMax={(v) => setF((s) => ({ ...s, pMax: v }))}
          />
          <RangeInputs
            label={t("catalog.units.areaRange")}
            min={f.aMin}
            max={f.aMax}
            onMin={(v) => setF((s) => ({ ...s, aMin: v }))}
            onMax={(v) => setF((s) => ({ ...s, aMax: v }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-300" aria-label={t("catalog.units.legend")}>
            {UNIT_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("size-3 rounded-[4px] border", CELL[s])} />
                {label("unitStatus", s)} <span className="font-mono text-ink-400">{counts[s]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] ring-2 ring-gold-400" /> {t("catalog.units.mine")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {active && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-mono text-xs text-gold-200">
                  {t("catalog.units.matches", { count: matched.length })}
                </motion.span>
              )}
            </AnimatePresence>
            {active && (
              <Button variant="ghost" size="sm" onClick={() => setF(EMPTY)}>
                <CloseCircle size={14} /> {t("catalog.units.reset")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {view === "chess" ? (
        <div className="rounded-3xl border border-line bg-ink-900/80 p-4 shadow-card md:p-6">
          {sections.length > 1 && (
            <div className="no-scrollbar -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1" role="tablist">
              {sections.map((s) => {
                const avail = items.filter((u) => u.section === s && u.status === "AVAILABLE").length;
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={s === activeSection}
                    onClick={() => setSection(s)}
                    className={cn(
                      "relative shrink-0 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                      s === activeSection ? "border-gold-500/40 text-stone-100" : "border-line text-ink-300 hover:border-line-strong hover:text-stone-100",
                    )}
                  >
                    {s === activeSection && <motion.span layoutId="units-section-pill" className="absolute inset-0 rounded-xl bg-gold-500/10" />}
                    <span className="relative">{t("catalog.units.section", { n: s })}</span>
                    <span className="relative ml-2 font-mono text-[11px] text-success">{avail}</span>
                  </button>
                );
              })}
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChessGrid
                units={items.filter((u) => u.section === activeSection)}
                match={match}
                selectedId={selected?.id ?? null}
                isMine={(id) => Boolean(purchaseForUnit(id))}
                onSelect={setSelected}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <UnitsTable units={matched} onSelect={setSelected} />
      )}

      <UnitSheet unit={selected} onClose={() => setSelected(null)} />
      {units.status === "loading" && <span className="sr-only">{t("common.actions.loading")}</span>}
    </div>
  );
}

function RangeInputs({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void }) {
  const { t } = useI18n();
  const cls =
    "h-11 w-full min-w-0 rounded-xl border border-line bg-ink-850 px-3 font-mono text-sm text-stone-100 placeholder:font-sans placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10";
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-ink-300">{label}</div>
      <div className="flex items-center gap-2">
        <input inputMode="decimal" value={min} onChange={(e) => onMin(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} placeholder={t("catalog.units.min")} aria-label={`${label} — ${t("catalog.units.min")}`} className={cls} />
        <span className="text-ink-500">–</span>
        <input inputMode="decimal" value={max} onChange={(e) => onMax(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} placeholder={t("catalog.units.max")} aria-label={`${label} — ${t("catalog.units.max")}`} className={cls} />
      </div>
    </div>
  );
}

function ChessGrid({
  units,
  match,
  selectedId,
  isMine,
  onSelect,
}: {
  units: UnitItem[];
  match: (u: UnitItem) => boolean;
  selectedId: string | null;
  isMine: (id: string) => boolean;
  onSelect: (u: UnitItem) => void;
}) {
  const { t, label } = useI18n();
  const fmt = useFormat();
  const floors = React.useMemo(() => {
    const m = new Map<number, UnitItem[]>();
    for (const u of units) m.set(u.floor, [...(m.get(u.floor) ?? []), u]);
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([floor, list]) => ({ floor, list: list.sort((a, b) => natural(a.number, b.number)) }));
  }, [units]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-flex min-w-full flex-col gap-1.5">
        {floors.map(({ floor, list }, r) => (
          <div key={floor} className="flex items-stretch gap-1.5">
            <div className="sticky left-0 z-10 grid w-12 shrink-0 place-items-center rounded-xl border border-line bg-ink-850 font-mono text-xs text-ink-300" title={t("catalog.units.floor", { n: floor })}>
              {floor}
            </div>
            {list.map((u, c) => {
              const ok = match(u);
              const mine = isMine(u.id);
              const ppsqm = u.area ? Number(u.price) / u.area : null;
              return (
                <Tooltip
                  key={u.id}
                  content={
                    <div className="min-w-44 space-y-1 py-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-stone-100">№ {u.number}</span>
                        <span className="text-ink-300">{label("unitStatus", u.status)}</span>
                      </div>
                      <div className="font-mono text-sm text-gold-200">{fmt.money(u.price)}</div>
                      <div className="text-ink-300">
                        {t("catalog.units.roomsN", { n: u.rooms })} · {fmt.area(u.area)}
                      </div>
                      {ppsqm && (
                        <div className="text-ink-400">
                          {t("catalog.units.pricePerSqm")}: <span className="font-mono">{fmt.compactMoney(ppsqm)}</span>
                        </div>
                      )}
                      <div className="pt-1 text-[10px] text-ink-400">{t("catalog.units.hoverHint")}</div>
                    </div>
                  }
                >
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: ok ? 1 : 0.18, scale: 1 }}
                    transition={{ duration: 0.3, delay: Math.min(r * 0.02 + c * 0.01, 0.4) }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onSelect(u)}
                    aria-label={`№ ${u.number}, ${t("catalog.units.floor", { n: u.floor })}, ${t("catalog.units.roomsN", { n: u.rooms })}, ${fmt.area(u.area)}, ${label("unitStatus", u.status)}`}
                    className={cn(
                      "relative flex h-14 w-[72px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border text-center transition-colors duration-200",
                      CELL[u.status],
                      selectedId === u.id && "ring-2 ring-gold-300 ring-offset-2 ring-offset-ink-900",
                      mine && "ring-2 ring-gold-400",
                    )}
                  >
                    <span className={cn("font-mono text-[13px] font-semibold", u.status === "SOLD" && "line-through decoration-ink-500")}>{u.number}</span>
                    <span className="text-[10px] opacity-80">
                      {u.rooms}x · {Math.round(u.area)}m²
                    </span>
                    {mine && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-gold-400 ring-2 ring-ink-900" />}
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function UnitsTable({ units, onSelect }: { units: UnitItem[]; onSelect: (u: UnitItem) => void }) {
  const { t, label } = useI18n();
  const fmt = useFormat();
  const columns: Column<UnitItem>[] = [
    { key: "number", header: t("catalog.units.number"), sortValue: (u) => u.number, exportValue: (u) => u.number, alwaysVisible: true, cell: (u) => <span className="font-mono font-semibold text-stone-100">{u.number}</span> },
    { key: "section", header: t("catalog.units.sectionShort"), sortValue: (u) => u.section, exportValue: (u) => u.section, hideOnMobile: true, cell: (u) => <span className="font-mono">{u.section}</span> },
    { key: "floor", header: t("catalog.units.floorShort"), sortValue: (u) => u.floor, exportValue: (u) => u.floor, cell: (u) => <span className="font-mono">{u.floor}</span> },
    { key: "type", header: t("catalog.units.type"), exportValue: (u) => label("unitType", u.type), hideOnMobile: true, cell: (u) => label("unitType", u.type) },
    { key: "rooms", header: t("catalog.units.rooms"), sortValue: (u) => u.rooms, exportValue: (u) => u.rooms, cell: (u) => <span className="font-mono">{u.rooms}</span> },
    { key: "area", header: t("catalog.units.area"), align: "right", sortValue: (u) => u.area, exportValue: (u) => u.area, cell: (u) => <span className="whitespace-nowrap font-mono">{fmt.area(u.area)}</span> },
    { key: "price", header: t("catalog.units.price"), align: "right", sortValue: (u) => Number(u.price), exportValue: (u) => u.price, cell: (u) => <span className="whitespace-nowrap font-mono font-medium text-stone-100">{fmt.compactMoney(u.price)}</span> },
    {
      key: "ppsqm",
      header: t("catalog.units.pricePerSqm"),
      align: "right",
      hideOnMobile: true,
      sortValue: (u) => (u.area ? Number(u.price) / u.area : 0),
      exportValue: (u) => (u.area ? Math.round(Number(u.price) / u.area) : ""),
      cell: (u) => <span className="whitespace-nowrap font-mono text-ink-300">{u.area ? fmt.compactMoney(Number(u.price) / u.area) : "—"}</span>,
    },
    { key: "status", header: t("catalog.units.status"), sortValue: (u) => u.status, exportValue: (u) => label("unitStatus", u.status), cell: (u) => <StatusBadge kind="unitStatus" value={u.status} /> },
    {
      key: "action",
      header: "",
      align: "right",
      alwaysVisible: true,
      cell: (u) => (
        <Button variant={u.status === "AVAILABLE" ? "outline" : "ghost"} size="sm" onClick={(e) => (e.stopPropagation(), onSelect(u))}>
          {t("catalog.units.select")}
        </Button>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={units}
      rowKey={(u) => u.id}
      onRowClick={onSelect}
      searchText={(u) => `${u.number} ${u.rooms} ${u.area}`}
      exportName="eka-xonadonlar"
      pageSize={20}
      emptyTitle={t("catalog.units.noMatch")}
      dense
    />
  );
}

function UnitSheet({ unit, onClose }: { unit: UnitItem | null; onClose: () => void }) {
  const { project: p, buy, purchaseForUnit } = useProject();
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const last = React.useRef(unit);
  if (unit) last.current = unit;
  const u = unit ?? last.current;
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planFailed, setPlanFailed] = React.useState(false);
  React.useEffect(() => setPlanFailed(false), [u?.id]);
  if (!u) return null;

  const mine = purchaseForUnit(u.id);
  const ppsqm = u.area ? Number(u.price) / u.area : null;
  const features = u.features && typeof u.features === "object" ? Object.entries(u.features).filter(([, v]) => v !== null && v !== undefined && v !== "") : [];

  const cta = mine ? (
    <Button variant="gold" size="lg" className="w-full" asChild>
      <Link href={`/app/purchases/${mine.id}`}>
        <TickCircle size={18} variant="Bold" />
        {t("catalog.units.viewPurchase")}
        <ArrowRight size={16} />
      </Link>
    </Button>
  ) : u.status === "AVAILABLE" && !p.viewer.isOwner ? (
    <Button variant="gold" size="lg" className="w-full" onClick={() => buy({ kind: "UNIT", unit: u })}>
      <ShoppingCart size={18} variant="Bold" />
      {t("catalog.units.buy")}
    </Button>
  ) : (
    <div className="rounded-xl border border-line bg-ink-850 px-4 py-3 text-center text-sm text-ink-300">
      {u.status === "RESERVED" ? t("catalog.units.reserved") : u.status === "SOLD" ? t("catalog.units.sold") : t("catalog.units.yours")}
    </div>
  );

  return (
    <Sheet
      open={Boolean(unit)}
      onOpenChange={(o) => !o && onClose()}
      title={t("catalog.units.unit", { n: u.number })}
      description={`${tr(p.name)} · ${t("catalog.units.location", { section: u.section, floor: u.floor })}`}
      footer={cta}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge kind="unitStatus" value={u.status} />
          <span className="text-xs text-ink-400">{label("unitType", u.type)}</span>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.units.plan")}</div>
          {u.planUrl && !planFailed ? (
            <button type="button" onClick={() => setPlanOpen(true)} className="group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-ink-850">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.planUrl} alt={t("catalog.units.plan")} onError={() => setPlanFailed(true)} className="aspect-[4/3] w-full object-contain p-2 transition-transform duration-700 group-hover:scale-[1.03]" />
            </button>
          ) : (
            <PlanSchematic rooms={u.rooms} area={u.area} note={t("catalog.units.noPlan")} />
          )}
        </div>

        <div className="rounded-2xl border border-gold-500/25 bg-gold-500/6 p-4">
          <div className="text-xs text-ink-400">{t("catalog.units.price")}</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-gold-gradient">{fmt.money(u.price, p.currency)}</div>
          {ppsqm && (
            <div className="mt-1 text-xs text-ink-300">
              {t("catalog.units.pricePerSqm")}: <span className="font-mono">{fmt.money(Math.round(ppsqm), p.currency)}</span>
            </div>
          )}
        </div>

        <div>
          <InfoRow label={t("catalog.units.area")} value={fmt.area(u.area)} mono />
          <InfoRow label={t("catalog.units.rooms")} value={t("catalog.units.roomsN", { n: u.rooms })} />
          <InfoRow label={t("catalog.units.floorShort")} value={`${u.floor} / ${p.floors}`} mono />
          <InfoRow label={t("catalog.units.sectionShort")} value={u.section} mono />
          <InfoRow label={t("catalog.units.type")} value={label("unitType", u.type)} />
        </div>

        {features.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.units.features")}</div>
            <div className="flex flex-wrap gap-2">
              {features.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-850 px-3 py-1 text-xs text-ink-200">
                  <Home2 size={12} className="text-gold-400" />
                  {tr(k)}
                  {typeof v === "boolean" ? (v ? "" : `: ${t("catalog.units.no")}`) : `: ${tr(String(v))}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {u.planUrl && (
        <Lightbox items={[{ src: u.planUrl, alt: t("catalog.units.plan"), download: u.planUrl }]} index={0} onIndexChange={() => {}} open={planOpen} onOpenChange={setPlanOpen} title={t("catalog.units.unit", { n: u.number })} />
      )}
    </Sheet>
  );
}

/** Generated schematic floor plan when no planUrl exists. */
function PlanSchematic({ rooms, area, note }: { rooms: number; area: number; note: string }) {
  const n = Math.max(1, Math.min(6, rooms));
  const cols = n <= 2 ? n : Math.ceil(n / 2);
  const rows = n <= 2 ? 1 : 2;
  return (
    <div className="bg-blueprint relative overflow-hidden rounded-2xl border border-line bg-ink-850 p-5">
      <svg viewBox="0 0 300 200" className="w-full" aria-hidden>
        <rect x="10" y="10" width="280" height="180" rx="4" className="fill-ink-900/60 stroke-gold-400" strokeWidth="2.5" />
        {Array.from({ length: n }).map((_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const w = 200 / cols;
          const h = 180 / rows;
          return <rect key={i} x={10 + c * w} y={10 + r * h} width={w} height={h} className="fill-none stroke-gold-500/60" strokeWidth="1.5" />;
        })}
        <rect x="210" y="10" width="80" height="180" className="fill-gold-500/5 stroke-gold-500/60" strokeWidth="1.5" />
        <path d="M250 190v-24" className="stroke-gold-300" strokeWidth="3" />
        <text x="150" y="108" textAnchor="middle" className="fill-ink-300 font-mono text-[14px]">
          {Math.round(area)} m²
        </text>
      </svg>
      <p className="mt-2 text-center text-xs text-ink-400">{note}</p>
    </div>
  );
}
