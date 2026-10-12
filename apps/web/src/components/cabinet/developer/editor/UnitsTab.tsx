"use client";
import * as React from "react";
import { toast } from "sonner";
import { Grid2, MagicStar } from "iconsax-reactjs";
import { UNIT_STATUSES, type UnitStatus } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/masked-input";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { ProjectDetail, UnitItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { asList, useApi } from "../../hooks";
import { useFmt } from "../../format";
import { ErrorState } from "../../states";
import { FormSection, parseNum } from "./fields";

type Gen = { sections: string; floors: string; perFloor: string; areaMin: string; areaMax: string; pricePerSqm: string };

export function UnitsTab({ projectId, detail }: { projectId: string; detail: ProjectDetail | null }) {
  const { t, label } = useI18n();
  const fmt = useFmt();
  const slug = detail?.slug ?? null;
  const units = useApi<UnitItem[]>(slug ? `/projects/${slug}/units` : null, undefined, { select: asList });
  const [gen, setGen] = React.useState<Gen>(() => ({
    sections: String(detail?.sections ?? 1),
    floors: String(detail?.floors ?? 9),
    perFloor: "4",
    areaMin: "45",
    areaMax: "110",
    pricePerSqm: detail?.pricePerSqm ? String(Math.round(Number(detail.pricePerSqm))) : "",
  }));
  const [generating, setGenerating] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const n = (k: keyof Gen) => parseNum(gen[k]);
  const genErrors: Partial<Record<keyof Gen, string | null>> = Object.fromEntries(
    (Object.keys(gen) as (keyof Gen)[]).map((k) => {
      const v = n(k);
      return [k, v === null || Number.isNaN(v) || v <= 0 ? t("app.developer.editor.basic.invalidNumber") : null];
    }),
  );
  if (!genErrors.areaMax && !genErrors.areaMin && (n("areaMax") ?? 0) < (n("areaMin") ?? 0)) genErrors.areaMax = t("app.developer.editor.basic.invalidNumber");
  const genValid = Object.values(genErrors).every((e) => !e);
  const count = genValid ? (n("sections") ?? 0) * (n("floors") ?? 0) * (n("perFloor") ?? 0) : 0;

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!genValid) return;
    setGenerating(true);
    try {
      await api.post(`/dev/projects/${projectId}/units`, {
        generate: {
          sections: n("sections"),
          floors: n("floors"),
          perFloor: n("perFloor"),
          areaMin: n("areaMin"),
          areaMax: n("areaMax"),
          pricePerSqm: n("pricePerSqm"),
        },
      });
      toast.success(t("app.developer.editor.units.generator.success"));
      setSubmitted(false);
      await units.reload();
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setGenerating(false);
    }
  };

  const patchUnit = async (u: UnitItem, body: Partial<{ price: number; status: UnitStatus }>) => {
    const prev = units.data ?? [];
    units.setData(prev.map((x) => (x.id === u.id ? { ...x, ...(body.price !== undefined ? { price: String(body.price) } : {}), ...(body.status ? { status: body.status } : {}) } : x)));
    try {
      await api.patch(`/dev/units/${u.id}`, body);
      toast.success(t("app.developer.editor.units.updated"));
    } catch (err) {
      units.setData(prev);
      toast.error(errorMessage(err, t("common.errors.generic")));
    }
  };

  const list = units.data ?? [];
  const summary = { AVAILABLE: 0, RESERVED: 0, SOLD: 0 } as Record<UnitStatus, number>;
  list.forEach((u) => (summary[u.status] = (summary[u.status] ?? 0) + 1));

  const statusOptions = UNIT_STATUSES.map((s) => ({ value: s, label: label("unitStatus", s) }));

  const columns: Column<UnitItem>[] = [
    { key: "number", header: t("app.common.number"), cell: (u) => <span className="font-mono font-semibold text-stone-100">{u.number}</span>, sortValue: (u) => u.number, exportValue: (u) => u.number, alwaysVisible: true },
    { key: "section", header: t("app.common.section"), align: "center", cell: (u) => <span className="font-mono">{u.section}</span>, sortValue: (u) => u.section, exportValue: (u) => u.section },
    { key: "floor", header: t("app.common.floor"), align: "center", cell: (u) => <span className="font-mono">{u.floor}</span>, sortValue: (u) => u.floor, exportValue: (u) => u.floor },
    { key: "type", header: t("app.purchases.columns.kind"), cell: (u) => <span className="text-xs text-ink-300">{label("unitType", u.type)}</span>, exportValue: (u) => u.type, hideOnMobile: true },
    { key: "rooms", header: t("app.common.rooms"), align: "center", cell: (u) => <span className="font-mono">{u.rooms}</span>, sortValue: (u) => u.rooms, exportValue: (u) => u.rooms, hideOnMobile: true },
    { key: "area", header: t("app.common.area"), align: "right", cell: (u) => <span className="font-mono text-xs">{fmt.area(u.area)}</span>, sortValue: (u) => u.area, exportValue: (u) => u.area },
    {
      key: "price",
      header: t("app.common.price"),
      align: "right",
      width: "200px",
      cell: (u) => <PriceCell unit={u} onCommit={(price) => patchUnit(u, { price })} />,
      sortValue: (u) => Number(u.price),
      exportValue: (u) => u.price,
    },
    {
      key: "status",
      header: t("app.common.status"),
      width: "180px",
      cell: (u) => (
        <div onClick={(e) => e.stopPropagation()} className="min-w-36">
          <Combobox
            size="sm"
            options={statusOptions}
            value={u.status}
            onChange={(v) => v && v !== u.status && void patchUnit(u, { status: v as UnitStatus })}
            searchable={false}
            clearable={false}
            aria-label={t("app.common.status")}
            className={cn(u.status === "AVAILABLE" ? "text-success" : u.status === "RESERVED" ? "text-warning" : "")}
          />
        </div>
      ),
      sortValue: (u) => u.status,
      exportValue: (u) => u.status,
    },
  ];

  return (
    <div className="space-y-6">
      <FormSection
        title={t("app.developer.editor.units.generator.title")}
        description={t("app.developer.editor.units.generator.subtitle")}
        aside={
          <span className="hidden size-10 place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow sm:grid">
            <MagicStar size={18} variant="Bold" />
          </span>
        }
      >
        <form onSubmit={generate} noValidate>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {(["sections", "floors", "perFloor", "areaMin", "areaMax", "pricePerSqm"] as const).map((k) => (
              <Field key={k} label={t(`app.developer.editor.units.generator.${k}`)} error={submitted ? genErrors[k] : null} htmlFor={`gen-${k}`}>
                <NumberInput
                  id={`gen-${k}`}
                  decimals={k === "areaMin" || k === "areaMax" ? 1 : 0}
                  suffix={k === "areaMin" || k === "areaMax" ? "m²" : k === "pricePerSqm" ? "so'm" : undefined}
                  value={(() => {
                    const v = parseNum(gen[k]);
                    return v === null || Number.isNaN(v) ? null : v;
                  })()}
                  onChange={(v) => setGen((g) => ({ ...g, [k]: v == null ? "" : String(v) }))}
                />
              </Field>
            ))}
          </div>
          <div className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-ink-300">
              {count > 0 && (
                <>
                  {t("app.developer.editor.units.generator.preview", { n: count })}
                  {n("pricePerSqm") ? <span className="ml-2 font-mono text-xs text-ink-400">· {fmt.money(n("pricePerSqm"))}{t("app.common.perSqm")}</span> : null}
                </>
              )}
            </span>
            <Button type="submit" variant="gold" loading={generating}>
              {!generating && <Grid2 size={16} />} {t("app.developer.editor.units.generator.submit")}
            </Button>
          </div>
        </form>
      </FormSection>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-base font-semibold text-stone-100">{t("app.developer.editor.units.title")}</h3>
          {list.length > 0 && (
            <span className="text-xs text-ink-400">
              {t("app.developer.editor.units.summary", { available: summary.AVAILABLE, reserved: summary.RESERVED, sold: summary.SOLD })}
            </span>
          )}
        </div>
        {units.error ? (
          <ErrorState error={units.error} onRetry={units.reload} />
        ) : (
          <DataTable
            columns={columns}
            data={list}
            loading={units.loading || (!slug && !units.data)}
            rowKey={(u) => u.id}
            searchText={(u) => `${u.number} ${u.section} ${u.floor}`}
            searchPlaceholder={t("app.developer.editor.units.search")}
            pageSize={20}
            dense
            exportName="units"
            emptyTitle={t("app.developer.editor.units.empty")}
            emptyHint={t("app.developer.editor.units.emptyHint")}
          />
        )}
      </div>
    </div>
  );
}

function PriceCell({ unit, onCommit }: { unit: UnitItem; onCommit: (price: number) => Promise<void> }) {
  const fmt = useFmt();
  const original = String(Math.round(Number(unit.price)));
  const [value, setValue] = React.useState(original);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setValue(original), [original]);
  const commit = async () => {
    const n = parseNum(value);
    if (n === null || Number.isNaN(n) || n < 0) {
      setValue(original);
      return;
    }
    if (String(Math.round(n)) === original) return;
    setSaving(true);
    await onCommit(Math.round(n));
    setSaving(false);
  };
  const changed = value !== original;
  return (
    <div className="relative ml-auto w-44" onClick={(e) => e.stopPropagation()} title={fmt.money(unit.price)}>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => setValue(e.target.value.replace(/[^\d\s]/g, ""))}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(original);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-9 w-full rounded-lg border bg-ink-850 pl-3 pr-8 text-right font-mono text-xs text-stone-100 transition focus:border-gold-500/60 focus:outline-none focus:ring-2 focus:ring-gold-500/15",
          changed ? "border-gold-500/50" : "border-transparent hover:border-line",
        )}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400">{saving ? <Spinner className="size-3.5" /> : <span className="text-[10px]">UZS</span>}</span>
    </div>
  );
}
