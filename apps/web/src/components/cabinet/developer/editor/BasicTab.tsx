"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Gallery, GalleryEdit, Gps, InfoCircle } from "iconsax-reactjs";
import { PROJECT_STATUSES, PROJECT_TYPES, REGIONS, type ProjectStatus, type ProjectType } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatMasked, MaskedInput, MoneyInput, NumberInput } from "@/components/ui/masked-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { api, errorMessage, uploadFile } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { unwrap } from "../../hooks";
import { useFmt } from "../../format";
import { FormSection, parseNum, Slider, toDateInput } from "./fields";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-none" />,
});

type Form = {
  name: string;
  tagline: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  region: string | null;
  district: string;
  address: string;
  lat: string;
  lng: string;
  cadastreNumber: string;
  landArea: string;
  totalArea: string;
  floors: string;
  sections: string;
  priceFrom: string;
  pricePerSqm: string;
  packagePrice: string;
  startDate: string;
  plannedEndDate: string;
  coverUrl: string;
  progress: number;
  width: string;
  depth: string;
  accent: string;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** form keeps strings (validation reports bad input); numeric controls get numbers */
const numVal = (v: string) => {
  const n = parseNum(v);
  return n === null || Number.isNaN(n) ? null : n;
};

function initial(d: ProjectDetail | null): Form {
  return {
    name: d?.name ?? "",
    tagline: d?.tagline ?? "",
    description: d?.description ?? "",
    type: d?.type ?? "RESIDENTIAL",
    status: d?.status ?? "PLANNING",
    region: d?.region ?? null,
    district: d?.district ?? "",
    address: d?.address ?? "",
    lat: str(d?.lat ?? 41.311081),
    lng: str(d?.lng ?? 69.240562),
    cadastreNumber: d?.cadastreNumber ?? "",
    landArea: str(d?.landArea),
    totalArea: str(d?.totalArea),
    floors: str(d?.floors ?? 9),
    sections: str(d?.sections ?? 1),
    priceFrom: d?.priceFrom ? String(Math.round(Number(d.priceFrom))) : "",
    pricePerSqm: d?.pricePerSqm ? String(Math.round(Number(d.pricePerSqm))) : "",
    packagePrice: d?.packagePrice ? String(Math.round(Number(d.packagePrice))) : "",
    startDate: toDateInput(d?.startDate),
    plannedEndDate: toDateInput(d?.plannedEndDate),
    coverUrl: d?.coverUrl ?? "",
    progress: d?.progress ?? 0,
    width: str(d?.massing?.width ?? ""),
    depth: str(d?.massing?.depth ?? ""),
    accent: d?.massing?.accent ?? "#c9a464",
  };
}

export function BasicTab({
  projectId,
  detail,
  onSaved,
}: {
  projectId: string | null;
  detail: ProjectDetail | null;
  onSaved: (project: { id: string; slug?: string }) => void;
}) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const [f, setF] = React.useState<Form>(() => initial(detail));
  const [base, setBase] = React.useState<Form>(() => initial(detail));
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [coverProgress, setCoverProgress] = React.useState<number | null>(null);

  React.useEffect(() => {
    const next = initial(detail);
    setF(next);
    setBase(next);
  }, [detail]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(base);

  // ── validation
  const req = t("app.developer.editor.basic.required");
  const badNum = t("app.developer.editor.basic.invalidNumber");
  const numErr = (v: string, opts: { required?: boolean; int?: boolean; min?: number } = {}) => {
    const n = parseNum(v);
    if (n === null) return opts.required ? req : null;
    if (Number.isNaN(n) || (opts.int && !Number.isInteger(n)) || (opts.min !== undefined && n < opts.min)) return badNum;
    return null;
  };
  const lat = parseNum(f.lat);
  const lng = parseNum(f.lng);
  const errors: Partial<Record<keyof Form, string | null>> = {
    name: f.name.trim().length < 2 ? req : null,
    region: !f.region ? req : null,
    address: f.address.trim().length < 3 ? req : null,
    lat: lat === null || Number.isNaN(lat) || lat < -90 || lat > 90 ? t("app.developer.editor.basic.invalidCoords") : null,
    lng: lng === null || Number.isNaN(lng) || lng < -180 || lng > 180 ? t("app.developer.editor.basic.invalidCoords") : null,
    floors: numErr(f.floors, { required: true, int: true, min: 1 }),
    sections: numErr(f.sections, { required: true, int: true, min: 1 }),
    landArea: numErr(f.landArea, { min: 0 }),
    totalArea: numErr(f.totalArea, { min: 0 }),
    priceFrom: numErr(f.priceFrom, { min: 0 }),
    pricePerSqm: numErr(f.pricePerSqm, { min: 0 }),
    packagePrice: numErr(f.packagePrice, { min: 0 }),
    width: numErr(f.width, { min: 1 }),
    depth: numErr(f.depth, { min: 1 }),
  };
  const err = (k: keyof Form) => (submitted ? errors[k] ?? null : null);
  const valid = Object.values(errors).every((e) => !e);

  const uploadCover = async (file: File) => {
    setCoverProgress(0);
    try {
      const res = await uploadFile(file, (p) => setCoverProgress(p));
      set("coverUrl", res.url);
    } catch (e) {
      toast.error(errorMessage(e, t("app.upload.failed")));
    } finally {
      setCoverProgress(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      toast.error(t("auth.errors.VALIDATION"));
      return;
    }
    setSaving(true);
    const editing = Boolean(projectId);
    // empty optional fields: omitted on create, cleared (null) on update when they had a value
    const opt = (k: keyof Form, v: string | number | null) => (v === null || v === "" ? (editing && base[k] !== "" ? null : undefined) : v);
    const num = (k: keyof Form) => opt(k, parseNum(String(f[k])));
    const width = parseNum(f.width);
    const depth = parseNum(f.depth);
    const payload = {
      name: f.name.trim(),
      tagline: opt("tagline", f.tagline.trim()),
      description: opt("description", f.description.trim()),
      type: f.type,
      status: f.status,
      region: f.region,
      district: opt("district", f.district.trim()),
      address: f.address.trim(),
      lat: lat!,
      lng: lng!,
      cadastreNumber: opt("cadastreNumber", f.cadastreNumber.trim()),
      landArea: num("landArea"),
      totalArea: num("totalArea"),
      floors: Number(f.floors),
      sections: Number(f.sections),
      priceFrom: num("priceFrom"),
      pricePerSqm: num("pricePerSqm"),
      packagePrice: num("packagePrice"),
      startDate: opt("startDate", f.startDate),
      plannedEndDate: opt("plannedEndDate", f.plannedEndDate),
      coverUrl: opt("coverUrl", f.coverUrl),
      massing: width && depth ? { floors: Number(f.floors), width, depth, accent: f.accent || undefined } : undefined,
      ...(editing ? { progress: f.progress } : {}),
    };
    try {
      const res = editing ? await api.patch<unknown>(`/dev/projects/${projectId}`, payload) : await api.post<unknown>("/dev/projects", payload);
      const project = unwrap<{ id: string; slug?: string }>(res, "project");
      toast.success(editing ? t("app.developer.editor.saved") : t("app.developer.editor.created"));
      setBase(f);
      setSubmitted(false);
      onSaved({ id: project?.id ?? projectId ?? "", slug: project?.slug });
    } catch (e2) {
      toast.error(errorMessage(e2, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = PROJECT_TYPES.map((v) => ({ value: v, label: label("projectType", v) }));
  const statusOptions = PROJECT_STATUSES.map((v) => ({ value: v, label: label("projectStatus", v) }));
  const regionOptions = REGIONS.map((r) => ({ value: r, label: tr(r) }));
  const L = (k: keyof typeof FIELD_KEYS) => t(FIELD_KEYS[k]);

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <FormSection title={t("app.developer.editor.basic.sections.general")}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={L("name")} error={err("name")} htmlFor="pe-name" className="md:col-span-2">
            <Input id="pe-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={t("app.developer.editor.basic.placeholders.name")} aria-invalid={Boolean(err("name")) || undefined} />
          </Field>
          <Field label={L("tagline")} htmlFor="pe-tagline" className="md:col-span-2">
            <Input id="pe-tagline" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder={t("app.developer.editor.basic.placeholders.tagline")} maxLength={255} />
          </Field>
          <Field label={L("type")}>
            <Combobox options={typeOptions} value={f.type} onChange={(v) => v && set("type", v as ProjectType)} searchable={false} clearable={false} aria-label={L("type")} />
          </Field>
          <Field label={L("status")}>
            <Combobox options={statusOptions} value={f.status} onChange={(v) => v && set("status", v as ProjectStatus)} searchable={false} clearable={false} aria-label={L("status")} />
          </Field>
          <Field label={L("description")} htmlFor="pe-desc" className="md:col-span-2">
            <Textarea id="pe-desc" rows={6} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder={t("app.developer.editor.basic.placeholders.description")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t("app.developer.editor.basic.sections.location")}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={L("region")} error={err("region")}>
            <Combobox options={regionOptions} value={f.region} onChange={(v) => set("region", v)} aria-label={L("region")} />
          </Field>
          <Field label={L("district")} htmlFor="pe-district">
            <Input id="pe-district" value={f.district} onChange={(e) => set("district", e.target.value)} placeholder={t("app.developer.editor.basic.placeholders.district")} />
          </Field>
          <Field label={L("address")} error={err("address")} htmlFor="pe-address" className="md:col-span-2">
            <Input id="pe-address" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder={t("app.developer.editor.basic.placeholders.address")} aria-invalid={Boolean(err("address")) || undefined} />
          </Field>
          <div className="overflow-hidden rounded-xl border border-line md:col-span-2">
            <LocationPicker
              value={lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : null}
              onChange={(la, ln) => setF((p) => ({ ...p, lat: String(la), lng: String(ln) }))}
            />
            <div className="flex items-center gap-2 border-t border-line bg-ink-850/60 px-3 py-2 text-xs text-ink-400">
              <Gps size={14} className="text-gold-300" /> {t("app.developer.editor.basic.mapHint")}
            </div>
          </div>
          <Field label={L("lat")} error={err("lat")} htmlFor="pe-lat">
            <Input id="pe-lat" inputMode="decimal" className="font-mono" value={f.lat} onChange={(e) => set("lat", e.target.value)} aria-invalid={Boolean(err("lat")) || undefined} />
          </Field>
          <Field label={L("lng")} error={err("lng")} htmlFor="pe-lng">
            <Input id="pe-lng" inputMode="decimal" className="font-mono" value={f.lng} onChange={(e) => set("lng", e.target.value)} aria-invalid={Boolean(err("lng")) || undefined} />
          </Field>
          <Field label={L("cadastre")} htmlFor="pe-cad" className="md:col-span-2">
            <MaskedInput id="pe-cad" mask="cadastre" value={f.cadastreNumber.replace(/\D/g, "")} onChange={(raw) => set("cadastreNumber", formatMasked("cadastre", raw))} />
          </Field>
        </div>
      </FormSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection title={t("app.developer.editor.basic.sections.specs")}>
          <div className="grid grid-cols-2 gap-5">
            <Field label={L("floors")} error={err("floors")} htmlFor="pe-floors">
              <NumberInput id="pe-floors" min={1} value={numVal(f.floors)} onChange={(v) => set("floors", v == null ? "" : String(v))} aria-invalid={Boolean(err("floors")) || undefined} />
            </Field>
            <Field label={L("sections")} error={err("sections")} htmlFor="pe-sections">
              <NumberInput id="pe-sections" min={1} value={numVal(f.sections)} onChange={(v) => set("sections", v == null ? "" : String(v))} aria-invalid={Boolean(err("sections")) || undefined} />
            </Field>
            <Field label={L("landArea")} error={err("landArea")} htmlFor="pe-land">
              <NumberInput id="pe-land" decimals={1} suffix="m²" value={numVal(f.landArea)} onChange={(v) => set("landArea", v == null ? "" : String(v))} />
            </Field>
            <Field label={L("totalArea")} error={err("totalArea")} htmlFor="pe-total">
              <NumberInput id="pe-total" decimals={1} suffix="m²" value={numVal(f.totalArea)} onChange={(v) => set("totalArea", v == null ? "" : String(v))} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("app.developer.editor.basic.sections.prices")}>
          <div className="grid gap-5">
            {(["priceFrom", "pricePerSqm", "packagePrice"] as const).map((k) => (
              <Field key={k} label={L(k)} error={err(k)} htmlFor={`pe-${k}`}>
                <MoneyInput id={`pe-${k}`} value={numVal(f[k])} onChange={(v) => set(k, v == null ? "" : String(Math.round(v)))} />
              </Field>
            ))}
          </div>
        </FormSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection title={t("app.developer.editor.basic.sections.dates")}>
          <div className="grid grid-cols-2 gap-5">
            <Field label={L("startDate")} htmlFor="pe-start">
              <DatePicker value={f.startDate || null} onChange={(v) => set("startDate", v ?? "")} aria-label={L("startDate")} />
            </Field>
            <Field label={L("plannedEndDate")} htmlFor="pe-end">
              <DatePicker value={f.plannedEndDate || null} onChange={(v) => set("plannedEndDate", v ?? "")} min={f.startDate || undefined} aria-label={L("plannedEndDate")} />
            </Field>
            {projectId && (
              <Field label={L("progress")} className="col-span-2">
                <Slider value={f.progress} onChange={(v) => set("progress", v)} aria-label={L("progress")} />
              </Field>
            )}
          </div>
        </FormSection>

        <FormSection title={t("app.developer.editor.basic.sections.media")} description={t("app.developer.editor.basic.coverHint")}>
          <label className="group relative block aspect-[16/9] cursor-pointer overflow-hidden rounded-xl border border-dashed border-line-strong bg-ink-850 transition hover:border-gold-500/50">
            {f.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.coverUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.02]" />
            ) : (
              <span className="bg-blueprint absolute inset-0 grid place-items-center">
                <span className="flex flex-col items-center gap-2 text-sm text-ink-300">
                  <Gallery size={28} variant="Bulk" className="text-gold-300" />
                  {t("app.developer.editor.basic.coverUpload")}
                </span>
              </span>
            )}
            {f.coverUrl && (
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-950/80 px-2.5 py-1.5 text-xs font-semibold text-stone-100 opacity-0 backdrop-blur transition group-hover:opacity-100">
                <GalleryEdit size={14} /> {t("app.developer.editor.basic.coverUpload")}
              </span>
            )}
            <AnimatePresence>
              {coverProgress !== null && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
                  <span className="w-1/2">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-fg/10">
                      <motion.span className="block h-full bg-gold-gradient" animate={{ width: `${Math.round(coverProgress * 100)}%` }} />
                    </span>
                    <span className="mt-2 block text-center font-mono text-xs text-stone-100">{Math.round(coverProgress * 100)}%</span>
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCover(file);
                e.target.value = "";
              }}
            />
          </label>
        </FormSection>
      </div>

      <FormSection title={t("app.developer.editor.basic.sections.massing")} description={t("app.developer.editor.basic.massingHint")}>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={L("width")} error={err("width")} htmlFor="pe-w">
            <NumberInput id="pe-w" decimals={1} suffix="m" value={numVal(f.width)} onChange={(v) => set("width", v == null ? "" : String(v))} placeholder="36" />
          </Field>
          <Field label={L("depth")} error={err("depth")} htmlFor="pe-d">
            <NumberInput id="pe-d" decimals={1} suffix="m" value={numVal(f.depth)} onChange={(v) => set("depth", v == null ? "" : String(v))} placeholder="18" />
          </Field>
          <Field label={L("accent")} htmlFor="pe-accent">
            <div className="flex h-11 items-center gap-3 rounded-xl border border-line bg-ink-850 px-2">
              <input id="pe-accent" type="color" value={f.accent} onChange={(e) => set("accent", e.target.value)} className="size-8 cursor-pointer rounded-lg border-0 bg-transparent" />
              <span className="font-mono text-sm uppercase text-ink-200">{f.accent}</span>
            </div>
          </Field>
        </div>
      </FormSection>

      {/* sticky save bar */}
      <div className="pointer-events-none sticky bottom-[calc(var(--shell-bottom,0px)+1rem)] z-30 flex justify-center">
        <AnimatePresence initial={false}>
          {(dirty || !projectId) && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="glass pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl px-4 py-3 shadow-lift"
            >
              <InfoCircle size={18} variant="Bulk" className={cn("shrink-0", dirty ? "text-gold-300" : "text-ink-400")} />
              <span className="flex-1 truncate text-sm text-ink-200">{projectId ? t("app.developer.editor.unsaved") : t("app.developer.editor.saveFirst")}</span>
              {projectId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setF(base)} disabled={saving}>
                  {t("common.actions.reset")}
                </Button>
              )}
              <Button type="submit" variant="gold" loading={saving}>
                {projectId ? t("common.actions.save") : t("common.actions.create")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

const FIELD_KEYS = {
  name: "app.developer.editor.basic.fields.name",
  tagline: "app.developer.editor.basic.fields.tagline",
  description: "app.developer.editor.basic.fields.description",
  type: "app.developer.editor.basic.fields.type",
  status: "app.developer.editor.basic.fields.status",
  region: "app.developer.editor.basic.fields.region",
  district: "app.developer.editor.basic.fields.district",
  address: "app.developer.editor.basic.fields.address",
  lat: "app.developer.editor.basic.fields.lat",
  lng: "app.developer.editor.basic.fields.lng",
  cadastre: "app.developer.editor.basic.fields.cadastre",
  landArea: "app.developer.editor.basic.fields.landArea",
  totalArea: "app.developer.editor.basic.fields.totalArea",
  floors: "app.developer.editor.basic.fields.floors",
  sections: "app.developer.editor.basic.fields.sections",
  priceFrom: "app.developer.editor.basic.fields.priceFrom",
  pricePerSqm: "app.developer.editor.basic.fields.pricePerSqm",
  packagePrice: "app.developer.editor.basic.fields.packagePrice",
  startDate: "app.developer.editor.basic.fields.startDate",
  plannedEndDate: "app.developer.editor.basic.fields.plannedEndDate",
  progress: "app.developer.editor.basic.fields.progress",
  width: "app.developer.editor.basic.fields.width",
  depth: "app.developer.editor.basic.fields.depth",
  accent: "app.developer.editor.basic.fields.accent",
} as const;
