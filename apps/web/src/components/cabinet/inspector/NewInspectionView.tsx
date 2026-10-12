"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { Icon as IconType } from "iconsax-reactjs";
import { Add, ClipboardTick, CloseCircle, Danger, ExportSquare, TickCircle, Trash, Warning2 } from "iconsax-reactjs";
import { INSPECTION_RESULTS, INSPECTION_TYPES, type InspectionResult, type InspectionType } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FileDrop, UploadList, useUploads } from "../FileDrop";
import { FormSection, todayInput } from "../developer/editor/fields";
import { ErrorState } from "../states";
import { SuccessBurst } from "../SuccessBurst";
import { useProjectSearch } from "./useProjectSearch";
import { PageHead } from "../kit";

type Severity = "LOW" | "MEDIUM" | "HIGH";
type Violation = { key: string; code: string; text: string; severity: Severity; resolved: boolean };

const RESULT_META: Record<InspectionResult, { icon: IconType; active: string; idle: string }> = {
  PASSED: { icon: TickCircle, active: "border-success/60 bg-success/10 text-success", idle: "hover:border-success/40" },
  ISSUES: { icon: Warning2, active: "border-warning/60 bg-warning/10 text-warning", idle: "hover:border-warning/40" },
  FAILED: { icon: CloseCircle, active: "border-danger/60 bg-danger/10 text-danger", idle: "hover:border-danger/40" },
};
const SEVERITY_TONE: Record<Severity, string> = { LOW: "text-info", MEDIUM: "text-warning", HIGH: "text-danger" };

const newViolation = (): Violation => ({ key: Math.random().toString(36).slice(2), code: "", text: "", severity: "MEDIUM", resolved: false });

export function NewInspectionView() {
  const { t, label } = useI18n();
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const search = useProjectSearch(projectId);
  const [type, setType] = React.useState<InspectionType>("SCHEDULED");
  const [result, setResult] = React.useState<InspectionResult>("PASSED");
  const [date, setDate] = React.useState(todayInput());
  const [summary, setSummary] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [violations, setViolations] = React.useState<Violation[]>([]);
  const uploads = useUploads();
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState<{ slug?: string } | null>(null);

  const errors = {
    project: !projectId ? t("app.inspector.inspection.errors.project") : null,
    summary: summary.trim().length < 5 ? t("app.inspector.inspection.errors.summary") : null,
    date: date ? null : t("app.developer.editor.basic.required"),
    violations: violations.some((v) => v.text.trim().length < 3) ? t("app.inspector.inspection.errors.violation") : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const patchV = (key: string, p: Partial<Violation>) => setViolations((vs) => vs.map((v) => (v.key === key ? { ...v, ...p } : v)));

  const reset = () => {
    setProjectId(null);
    setType("SCHEDULED");
    setResult("PASSED");
    setDate(todayInput());
    setSummary("");
    setNotes("");
    setViolations([]);
    uploads.reset();
    setSubmitted(false);
    setDone(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || uploads.busy) {
      if (!valid) toast.error(t("auth.errors.VALIDATION"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/inspections", {
        projectId,
        type,
        result,
        date,
        summary: summary.trim(),
        notes: notes.trim() || undefined,
        violations: violations.length ? violations.map(({ code, text, severity, resolved }) => ({ code: code.trim(), text: text.trim(), severity, resolved })) : undefined,
        fileIds: uploads.done.length ? uploads.done.map((f) => f.id) : undefined,
      });
      toast.success(t("app.inspector.inspection.success"));
      setDone({ slug: search.selected?.slug });
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div>
        <PageHead icon={ClipboardTick} eyebrow={t("app.shell.sections.inspector")} title={t("app.inspector.inspection.title")} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-line bg-ink-900 px-6 pb-10 pt-4 text-center shadow-card">
          <SuccessBurst size={96} />
          <h2 className="-mt-4 font-display text-3xl font-medium text-stone-100">{t("app.inspector.inspection.success")}</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-300">{t("app.inspector.inspection.successText")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {done.slug && (
              <Button asChild variant="secondary">
                <Link href={`/projects/${done.slug}`} target="_blank">
                  {t("app.inspector.inspection.viewProject")} <ExportSquare size={16} />
                </Link>
              </Button>
            )}
            <Button variant="gold" onClick={reset}>
              <Add size={18} /> {t("app.inspector.inspection.another")}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <PageHead icon={ClipboardTick} eyebrow={t("app.shell.sections.inspector")} title={t("app.inspector.inspection.title")} description={t("app.inspector.inspection.subtitle")} />
      <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <FormSection title={t("app.inspector.inspection.sections.object")}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t("app.inspector.inspection.fields.project")} error={submitted ? errors.project : null} className="md:col-span-2">
                <Combobox
                  options={search.options}
                  value={projectId}
                  onChange={setProjectId}
                  onSearch={search.onSearch}
                  loading={search.loading}
                  placeholder={t("app.inspector.inspection.fields.projectPlaceholder")}
                  aria-label={t("app.inspector.inspection.fields.project")}
                />
                {search.error != null && !search.options.length && <ErrorState error={search.error} onRetry={search.retry} compact className="mt-2" />}
              </Field>
              <Field label={t("app.inspector.inspection.fields.type")}>
                <Combobox
                  options={INSPECTION_TYPES.map((v) => ({ value: v, label: label("inspectionType", v) }))}
                  value={type}
                  onChange={(v) => v && setType(v as InspectionType)}
                  searchable={false}
                  clearable={false}
                  aria-label={t("app.inspector.inspection.fields.type")}
                />
              </Field>
              <Field label={t("app.inspector.inspection.fields.date")} error={submitted ? errors.date : null} htmlFor="in-date">
                <DatePicker value={date || null} onChange={(v) => setDate(v ?? "")} max={todayInput()} clearable={false} aria-label={t("app.inspector.inspection.fields.date")} />
              </Field>
              <div className="md:col-span-2">
                <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-200">{t("app.inspector.inspection.fields.result")}</div>
                <div role="radiogroup" className="grid grid-cols-3 gap-2.5">
                  {INSPECTION_RESULTS.map((r) => {
                    const meta = RESULT_META[r];
                    const Icon = meta.icon;
                    const active = result === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setResult(r)}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all duration-200 active:scale-[0.98]",
                          active ? meta.active : cn("border-line bg-ink-850 text-ink-300", meta.idle),
                        )}
                      >
                        <Icon size={24} variant={active ? "Bold" : "Linear"} />
                        <span className={cn("text-xs font-semibold", active ? "" : "text-ink-200")}>{label("inspectionResult", r)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title={t("app.inspector.inspection.sections.findings")}>
            <div className="grid gap-5">
              <Field label={t("app.inspector.inspection.fields.summary")} error={submitted ? errors.summary : null} htmlFor="in-summary">
                <Textarea id="in-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("app.inspector.inspection.fields.summaryPlaceholder")} aria-invalid={Boolean(submitted && errors.summary) || undefined} />
              </Field>
              <Field label={t("app.inspector.inspection.fields.notes")} htmlFor="in-notes">
                <Textarea id="in-notes" rows={3} className="min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("app.inspector.inspection.fields.notesPlaceholder")} />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title={t("app.inspector.inspection.sections.violations")}
            aside={
              <Button type="button" size="sm" variant="outline" onClick={() => setViolations((v) => [...v, newViolation()])}>
                <Add size={16} /> {t("app.inspector.inspection.violations.add")}
              </Button>
            }
          >
            {violations.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-5 text-sm text-ink-400">
                <TickCircle size={20} variant="Bulk" className="text-success" /> {t("app.inspector.inspection.violations.empty")}
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {violations.map((v, i) => (
                    <motion.li
                      key={v.key}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden rounded-xl border border-line bg-ink-850/60 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", SEVERITY_TONE[v.severity])}>
                          <Danger size={14} variant="Bold" /> #{i + 1}
                        </span>
                        <Button type="button" size="icon-sm" variant="ghost" className="hover:text-danger" onClick={() => setViolations((vs) => vs.filter((x) => x.key !== v.key))} aria-label={t("app.inspector.inspection.violations.remove")}>
                          <Trash size={16} />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                        <Field label={t("app.inspector.inspection.violations.code")} htmlFor={`v-code-${v.key}`}>
                          <Input id={`v-code-${v.key}`} className="font-mono" value={v.code} onChange={(e) => patchV(v.key, { code: e.target.value })} placeholder={t("app.inspector.inspection.violations.codePlaceholder")} />
                        </Field>
                        <Field label={t("app.inspector.inspection.violations.text")} htmlFor={`v-text-${v.key}`} error={submitted && v.text.trim().length < 3 ? t("app.inspector.inspection.errors.violation") : null}>
                          <Input id={`v-text-${v.key}`} value={v.text} onChange={(e) => patchV(v.key, { text: e.target.value })} placeholder={t("app.inspector.inspection.violations.textPlaceholder")} />
                        </Field>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <div role="radiogroup" aria-label={t("app.inspector.inspection.violations.severity")} className="inline-flex rounded-lg border border-line bg-ink-900 p-0.5">
                          {(["LOW", "MEDIUM", "HIGH"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              role="radio"
                              aria-checked={v.severity === s}
                              onClick={() => patchV(v.key, { severity: s })}
                              className={cn(
                                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition",
                                v.severity === s ? cn("bg-ink-700", SEVERITY_TONE[s]) : "text-ink-400 hover:text-stone-100",
                              )}
                            >
                              {t(`app.inspector.inspection.violations.severities.${s}`)}
                            </button>
                          ))}
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-200">
                          <input type="checkbox" checked={v.resolved} onChange={(e) => patchV(v.key, { resolved: e.target.checked })} className="size-4 cursor-pointer accent-gold-500" />
                          {t("app.inspector.inspection.violations.resolved")}
                        </label>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </FormSection>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <FormSection title={t("app.inspector.inspection.sections.files")}>
            <FileDrop onFiles={(f) => void uploads.add(f)} accept="image/*,.pdf" multiple types="JPG, PNG, PDF" compact />
            {uploads.items.length > 0 && <UploadList items={uploads.items} onRemove={uploads.remove} className="mt-3" />}
          </FormSection>
          <Button type="submit" variant="gold" size="lg" className="w-full" loading={saving} disabled={uploads.busy}>
            {t("app.inspector.inspection.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
