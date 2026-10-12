"use client";
import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Gallery } from "iconsax-reactjs";
import { PROGRESS_PHASES, type ProgressPhase } from "@eka/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FileDrop, UploadList, useUploads } from "../../FileDrop";
import { useFmt } from "../../format";
import { FormSection, Slider, todayInput } from "./fields";

export function ProgressTab({ projectId, detail, onChanged }: { projectId: string; detail: ProjectDetail | null; onChanged: () => Promise<void> | void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const uploads = useUploads();
  const [phase, setPhase] = React.useState<ProgressPhase>(detail?.status === "COMMISSIONED" ? "POST_HANDOVER" : "CONSTRUCTION");
  const [title, setTitle] = React.useState("");
  const [stage, setStage] = React.useState("");
  const [percent, setPercent] = React.useState(detail?.progress ?? 0);
  const [withPercent, setWithPercent] = React.useState(true);
  const [date, setDate] = React.useState(todayInput());
  const [body, setBody] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const errors = {
    title: title.trim().length < 3 ? t("app.developer.editor.basic.required") : null,
    date: date ? null : t("app.developer.editor.basic.required"),
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.title || errors.date) return;
    if (uploads.busy) {
      toast.message(t("app.developer.editor.progress.waitUploads"));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/dev/projects/${projectId}/progress`, {
        phase,
        title: title.trim(),
        body: body.trim() || undefined,
        stage: stage.trim() || undefined,
        percent: phase === "CONSTRUCTION" && withPercent ? percent : undefined,
        date,
        fileIds: uploads.done.map((f) => f.id),
      });
      toast.success(t("app.developer.editor.progress.success"));
      setTitle("");
      setStage("");
      setBody("");
      uploads.reset();
      setSubmitted(false);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  const updates = [...(detail?.progressUpdates ?? [])].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <FormSection title={t("app.developer.editor.progress.title")} description={t("app.developer.editor.progress.subtitle")} className="self-start">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label={t("app.developer.editor.progress.fields.phase")}>
            <Combobox
              options={PROGRESS_PHASES.map((p) => ({ value: p, label: label("progressPhase", p) }))}
              value={phase}
              onChange={(v) => v && setPhase(v as ProgressPhase)}
              searchable={false}
              clearable={false}
              aria-label={t("app.developer.editor.progress.fields.phase")}
            />
          </Field>
          <Field label={t("app.developer.editor.progress.fields.date")} error={submitted ? errors.date : null} htmlFor="pr-date">
            <Input id="pr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("app.developer.editor.progress.fields.title")} error={submitted ? errors.title : null} htmlFor="pr-title" className="sm:col-span-2">
            <Input id="pr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("app.developer.editor.progress.placeholders.title")} aria-invalid={Boolean(submitted && errors.title) || undefined} />
          </Field>
          <Field label={t("app.developer.editor.progress.fields.stage")} htmlFor="pr-stage" className="sm:col-span-2">
            <Input id="pr-stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder={t("app.developer.editor.progress.placeholders.stage")} />
          </Field>
          {phase === "CONSTRUCTION" && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs font-semibold tracking-wide text-ink-200">
                <input type="checkbox" checked={withPercent} onChange={(e) => setWithPercent(e.target.checked)} className="size-4 cursor-pointer accent-gold-500" />
                {t("app.developer.editor.progress.fields.percent")}
              </label>
              <div className={cn(!withPercent && "pointer-events-none opacity-40")}>
                <Slider value={percent} onChange={setPercent} aria-label={t("app.developer.editor.progress.fields.percent")} />
              </div>
            </div>
          )}
          <Field label={t("app.developer.editor.progress.fields.body")} htmlFor="pr-body" className="sm:col-span-2">
            <Textarea id="pr-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("app.developer.editor.progress.placeholders.body")} />
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-200">{t("app.developer.editor.progress.fields.media")}</div>
            <FileDrop onFiles={(f) => void uploads.add(f)} accept="image/*,video/mp4,video/webm" multiple types="JPG, PNG, WEBP, MP4" compact />
            {uploads.items.length > 0 && <UploadList items={uploads.items} onRemove={uploads.remove} className="mt-3" />}
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="gold" loading={saving} disabled={uploads.busy}>
              {t("app.developer.editor.progress.submit")}
            </Button>
          </div>
        </form>
      </FormSection>

      <div>
        <h3 className="mb-3 text-base font-semibold text-stone-100">
          {t("app.developer.editor.progress.list")} <span className="font-mono text-sm text-ink-400">· {updates.length}</span>
        </h3>
        {updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-400">{t("app.developer.editor.progress.empty")}</div>
        ) : (
          <ol className="relative ml-2 space-y-4 border-l border-line pl-6">
            {updates.map((u, i) => (
              <motion.li key={u.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} className="relative">
                <span className={cn("absolute -left-[31px] top-4 size-3 rounded-full ring-4 ring-ink-950", u.phase === "POST_HANDOVER" ? "bg-info" : "bg-gold-400")} />
                <div className="rounded-xl border border-line bg-ink-900 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={u.phase === "POST_HANDOVER" ? "info" : "gold"}>{label("progressPhase", u.phase)}</Badge>
                    <span className="text-ink-400">{fmt.date(u.date)}</span>
                    {u.percent != null && <span className="ml-auto font-mono text-gold-300">{u.percent}%</span>}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-100">{tr(u.title)}</div>
                  {u.body && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-300">{tr(u.body)}</p>}
                  {u.media?.length > 0 && (
                    <div className="mt-3 flex gap-1.5">
                      {u.media.slice(0, 5).map((m) =>
                        m.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={m.id} src={m.url} alt="" loading="lazy" className="size-12 rounded-lg border border-line object-cover" />
                        ) : (
                          <span key={m.id} className="grid size-12 place-items-center rounded-lg border border-line bg-ink-850 text-gold-300">
                            <Gallery size={16} />
                          </span>
                        ),
                      )}
                      {u.media.length > 5 && <span className="grid size-12 place-items-center rounded-lg border border-line bg-ink-850 font-mono text-xs text-ink-300">+{u.media.length - 5}</span>}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
