"use client";
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown2, CloseCircle, Filter, MoneySend, SearchNormal1, ShieldTick } from "iconsax-reactjs";
import { PROJECT_STATUSES, PROJECT_TYPES, REGIONS } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { activeFilterCount, EMPTY_FILTERS, type CatalogFilters } from "./filters";
import { useFormat } from "./use-format";

type Patch = Partial<CatalogFilters>;

export function FilterBar({
  filters,
  onChange,
  pending,
}: {
  filters: CatalogFilters;
  onChange: (patch: Patch) => void;
  pending?: boolean;
}) {
  const { t, label } = useI18n();
  const fmt = useFormat();
  const [open, setOpen] = React.useState(false);
  const active = activeFilterCount(filters);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onSearch = React.useCallback((q: string) => onChangeRef.current({ q }), []);

  const regionOptions = React.useMemo(() => REGIONS.map((r) => ({ value: r, label: fmt.region(r), keywords: r })), [fmt]);
  const statusOptions = React.useMemo(() => PROJECT_STATUSES.map((s) => ({ value: s, label: label("projectStatus", s) })), [label]);
  const typeOptions = React.useMemo(() => PROJECT_TYPES.map((s) => ({ value: s, label: label("projectType", s) })), [label]);

  const controls = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.1fr)_auto]">
      <Combobox
        aria-label={t("catalog.filters.region")}
        options={regionOptions}
        value={filters.region}
        onChange={(v) => onChange({ region: v })}
        placeholder={t("catalog.filters.allRegions")}
      />
      <Combobox
        aria-label={t("catalog.filters.status")}
        options={statusOptions}
        value={filters.status}
        onChange={(v) => onChange({ status: v as CatalogFilters["status"] })}
        placeholder={t("catalog.filters.anyStatus")}
        searchable={false}
      />
      <Combobox
        aria-label={t("catalog.filters.type")}
        options={typeOptions}
        value={filters.type}
        onChange={(v) => onChange({ type: v as CatalogFilters["type"] })}
        placeholder={t("catalog.filters.anyType")}
        searchable={false}
      />
      <PriceRange min={filters.minPrice} max={filters.maxPrice} onChange={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })} />
      <VerifiedSwitch checked={filters.verified} onChange={(verified) => onChange({ verified })} />
    </div>
  );

  return (
    <div className="glass eka-in relative z-20 rounded-3xl p-3 shadow-lift ring-1 ring-gold-500/15 md:p-4" style={{ "--d": "520ms" } as React.CSSProperties}>
      <div className="flex gap-3">
        <SearchBox value={filters.q} onSearch={onSearch} pending={pending} />
        <Button
          variant="secondary"
          size="lg"
          className="relative shrink-0 rounded-xl lg:hidden"
          aria-expanded={open}
          aria-controls="catalog-filters"
          onClick={() => setOpen((o) => !o)}
        >
          <Filter size={18} variant="Bulk" className="text-gold-400" />
          <span className="hidden sm:inline">{t("catalog.filters.toggle")}</span>
          {active > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-gold-gradient font-mono text-[10px] font-bold text-onyx">{active}</span>
          )}
        </Button>
      </div>

      {/* desktop: always visible */}
      <div className="mt-3 hidden lg:block">{controls}</div>
      {/* mobile / tablet: collapsible */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="catalog-filters"
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden lg:hidden"
          >
            <div className="pt-3">{controls}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <ActiveChips filters={filters} onChange={onChange} />
    </div>
  );
}

function SearchBox({ value, onSearch, pending }: { value: string; onSearch: (q: string) => void; pending?: boolean }) {
  const { t } = useI18n();
  const [q, setQ] = React.useState(value);
  const pushed = React.useRef(value);

  // external changes (chips, "clear all", back/forward)
  React.useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value;
      setQ(value);
    }
  }, [value]);

  React.useEffect(() => {
    const next = q.trim();
    if (next === pushed.current) return;
    const id = setTimeout(() => {
      pushed.current = next;
      onSearch(next);
    }, 400);
    return () => clearTimeout(id);
  }, [q, onSearch]);

  return (
    <div className="relative min-w-0 flex-1">
      <SearchNormal1 size={18} variant="TwoTone" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold-400" />
      <label htmlFor="catalog-search" className="sr-only">
        {t("catalog.filters.searchLabel")}
      </label>
      <input
        id="catalog-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            pushed.current = q.trim();
            onSearch(q.trim());
          }
        }}
        placeholder={t("catalog.filters.search")}
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-line bg-ink-850 pl-11 pr-11 text-[15px] text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Spinner className="text-gold-400" />
        ) : q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="grid cursor-pointer place-items-center rounded-md p-1 text-ink-400 transition hover:text-stone-100"
            aria-label={t("catalog.filters.reset")}
          >
            <CloseCircle size={18} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function VerifiedSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={t("catalog.filters.verifiedHint")}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 text-sm transition-colors",
        checked ? "border-gold-500/50 bg-gold-500/10 text-gold-200" : "border-line bg-ink-850 text-ink-200 hover:border-line-strong",
      )}
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        <ShieldTick size={18} variant={checked ? "Bold" : "Linear"} className={checked ? "text-gold-300" : "text-ink-400"} />
        {t("catalog.filters.verifiedOnly")}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-gold-500" : "bg-ink-600")}>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn("absolute top-0.5 size-4 rounded-full bg-stone-100 shadow", checked ? "right-0.5" : "left-0.5")}
        />
      </span>
    </button>
  );
}

const PRESETS: { key: "upTo500m" | "m500to1b" | "b1to2b" | "from2b"; min: number | null; max: number | null }[] = [
  { key: "upTo500m", min: null, max: 500_000_000 },
  { key: "m500to1b", min: 500_000_000, max: 1_000_000_000 },
  { key: "b1to2b", min: 1_000_000_000, max: 2_000_000_000 },
  { key: "from2b", min: 2_000_000_000, max: null },
];

function PriceRange({ min, max, onChange }: { min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [open, setOpen] = React.useState(false);
  const toMln = (v: number | null) => (v ? String(Math.round(v / 1e6)) : "");
  const [lo, setLo] = React.useState(toMln(min));
  const [hi, setHi] = React.useState(toMln(max));

  React.useEffect(() => {
    if (open) {
      setLo(toMln(min));
      setHi(toMln(max));
    }
  }, [open, min, max]);

  const parse = (s: string) => {
    const n = Number(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) : null;
  };
  const apply = (a: number | null, b: number | null) => {
    if (a && b && a > b) [a, b] = [b, a];
    onChange(a, b);
    setOpen(false);
  };

  const display =
    min || max
      ? min && max
        ? `${fmt.compact(min)} – ${fmt.compact(max)}`
        : min
          ? t("catalog.filters.chips.minPrice", { value: fmt.compact(min) })
          : t("catalog.filters.chips.maxPrice", { value: fmt.compact(max) })
      : null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t("catalog.filters.price")}
          className="group flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-line bg-ink-850 px-3.5 text-left text-sm transition-colors hover:border-line-strong data-[state=open]:border-gold-500/60"
        >
          <MoneySend size={17} variant="Bulk" className="shrink-0 text-gold-400" />
          <span className={cn("flex-1 truncate", display ? "text-stone-100" : "text-ink-400")}>{display ?? t("catalog.filters.priceAny")}</span>
          <ArrowDown2 size={16} className="text-ink-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[min(92vw,340px)] rounded-2xl border border-line-strong bg-ink-850/95 p-4 shadow-lift backdrop-blur-xl data-[state=open]:animate-[popIn_.18s_ease-out]"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply(parse(lo), parse(hi));
            }}
          >
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.filters.price")}</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["lo", lo, setLo, t("catalog.filters.minPrice")],
                  ["hi", hi, setHi, t("catalog.filters.maxPrice")],
                ] as const
              ).map(([id, v, set, l]) => (
                <label key={id} className="block">
                  <span className="mb-1 block text-[11px] text-ink-400">{l}</span>
                  <span className="relative block">
                    <input
                      inputMode="numeric"
                      value={v}
                      onChange={(e) => set(e.target.value.replace(/[^\d]/g, ""))}
                      className="h-10 w-full rounded-lg border border-line bg-ink-900 pl-3 pr-14 font-mono text-sm text-stone-100 focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10"
                      placeholder="0"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">
                      {t("catalog.money.mln")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">{t("catalog.filters.priceHint")}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const on = (p.min ?? null) === (min ?? null) && (p.max ?? null) === (max ?? null);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => apply(p.min, p.max)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition",
                      on ? "border-gold-500/50 bg-gold-500/10 text-gold-200" : "border-line text-ink-200 hover:border-line-strong hover:bg-fg/5",
                    )}
                  >
                    {t(`catalog.filters.presets.${p.key}`)}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between gap-2 border-t border-line pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => apply(null, null)}>
                {t("catalog.filters.reset")}
              </Button>
              <Button type="submit" variant="gold" size="sm">
                {t("catalog.filters.apply")}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ActiveChips({ filters, onChange }: { filters: CatalogFilters; onChange: (p: Patch) => void }) {
  const { t, label } = useI18n();
  const fmt = useFormat();
  const chips: { key: string; text: string; clear: Patch }[] = [];
  if (filters.q) chips.push({ key: "q", text: t("catalog.filters.chips.q", { value: filters.q }), clear: { q: "" } });
  if (filters.region) chips.push({ key: "region", text: fmt.region(filters.region), clear: { region: null } });
  if (filters.status) chips.push({ key: "status", text: label("projectStatus", filters.status), clear: { status: null } });
  if (filters.type) chips.push({ key: "type", text: label("projectType", filters.type), clear: { type: null } });
  if (filters.minPrice)
    chips.push({ key: "min", text: t("catalog.filters.chips.minPrice", { value: fmt.compact(filters.minPrice) }), clear: { minPrice: null } });
  if (filters.maxPrice)
    chips.push({ key: "max", text: t("catalog.filters.chips.maxPrice", { value: fmt.compact(filters.maxPrice) }), clear: { maxPrice: null } });
  if (filters.verified) chips.push({ key: "verified", text: t("catalog.filters.chips.verified"), clear: { verified: false } });

  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          key="chips"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-2 pt-3" aria-label={t("catalog.filters.active")}>
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.button
                  layout
                  key={c.key}
                  type="button"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => onChange(c.clear)}
                  aria-label={`${t("catalog.filters.remove")}: ${c.text}`}
                  className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/8 py-1 pl-3 pr-1.5 text-xs font-medium text-gold-200 transition hover:border-gold-400/60 hover:bg-gold-500/15"
                >
                  <span className="max-w-48 truncate">{c.text}</span>
                  <CloseCircle size={15} className="opacity-70 transition group-hover:opacity-100" />
                </motion.button>
              ))}
              {chips.length > 1 && (
                <motion.button
                  layout
                  key="__all"
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onChange({ ...EMPTY_FILTERS })}
                  className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-ink-300 underline-offset-4 transition hover:text-stone-100 hover:underline"
                >
                  {t("catalog.filters.clearAll")}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
