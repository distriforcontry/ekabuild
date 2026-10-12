"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { DocumentDownload, Trash, Warning2 } from "iconsax-reactjs";
import { ACCESS_LEVELS, DOCUMENT_TYPES, type AccessLevel, type DocumentType } from "@eka/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { DocumentItem, ProjectDetail } from "@/lib/types";
import { downloadUrl } from "../../FilePreviewDialog";
import { FileDrop, UploadList, useUploads } from "../../FileDrop";
import { FileTypeIcon } from "../../FileTypeIcon";
import { useFmt } from "../../format";
import { ConfirmDialog, HashChip } from "../../ui";
import { FormSection } from "./fields";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,.ifc,.zip,.glb,.gltf";

export function DocumentsTab({ projectId, detail, onChanged }: { projectId: string; detail: ProjectDetail | null; onChanged: () => Promise<void> | void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const uploads = useUploads();
  const [type, setType] = React.useState<DocumentType>("BUILDING_PERMIT");
  const [access, setAccess] = React.useState<AccessLevel>("PUBLIC");
  const [title, setTitle] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [issuedAt, setIssuedAt] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<DocumentItem | null>(null);

  const file = uploads.done[0] ?? null;
  const errors = {
    title: title.trim().length < 2 ? t("app.developer.editor.basic.required") : null,
    file: !file ? t("app.developer.editor.documents.fileRequired") : null,
  };

  const onFiles = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    void uploads.add([f], true);
  };

  const reset = () => {
    uploads.reset();
    setTitle("");
    setNumber("");
    setIssuer("");
    setIssuedAt("");
    setExpiresAt("");
    setDescription("");
    setSubmitted(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.title || errors.file || uploads.busy) return;
    setSaving(true);
    try {
      await api.post(`/dev/projects/${projectId}/documents`, {
        type,
        access,
        title: title.trim(),
        description: description.trim() || undefined,
        number: number.trim() || undefined,
        issuer: issuer.trim() || undefined,
        issuedAt: issuedAt || undefined,
        expiresAt: expiresAt || undefined,
        fileId: file!.id,
      });
      toast.success(t("app.developer.editor.documents.success"));
      reset();
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await api.del(`/dev/documents/${toDelete.id}`);
      toast.success(t("app.developer.editor.documents.deleted"));
      setToDelete(null);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    }
  };

  const docs = detail?.documents ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <FormSection title={t("app.developer.editor.documents.title")} description={t("app.developer.editor.documents.subtitle")} className="self-start">
        <form onSubmit={submit} noValidate className="space-y-5">
          <FileDrop onFiles={onFiles} accept={ACCEPT} types="PDF, JPG, PNG, DWG, IFC, ZIP" />
          {uploads.items.length > 0 && <UploadList items={uploads.items} onRemove={uploads.remove} />}
          {submitted && errors.file && <p className="-mt-3 text-xs text-danger">{errors.file}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("app.developer.editor.documents.fields.type")}>
              <Combobox
                options={DOCUMENT_TYPES.map((v) => ({ value: v, label: label("documentType", v) }))}
                value={type}
                onChange={(v) => v && setType(v as DocumentType)}
                clearable={false}
                aria-label={t("app.developer.editor.documents.fields.type")}
              />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.access")}>
              <Combobox
                options={ACCESS_LEVELS.map((v) => ({ value: v, label: label("access", v), description: t(`app.developer.editor.documents.accessHints.${v}`) }))}
                value={access}
                onChange={(v) => v && setAccess(v as AccessLevel)}
                searchable={false}
                clearable={false}
                aria-label={t("app.developer.editor.documents.fields.access")}
              />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.title")} error={submitted ? errors.title : null} htmlFor="doc-title" className="sm:col-span-2">
              <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(submitted && errors.title) || undefined} />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.number")} htmlFor="doc-number">
              <Input id="doc-number" className="font-mono" value={number} onChange={(e) => setNumber(e.target.value)} />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.issuer")} htmlFor="doc-issuer">
              <Input id="doc-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.issuedAt")} htmlFor="doc-issued">
              <DatePicker value={issuedAt || null} onChange={(v) => setIssuedAt(v ?? "")} aria-label={t("app.developer.editor.documents.fields.issuedAt")} />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.expiresAt")} htmlFor="doc-expires">
              <DatePicker value={expiresAt || null} onChange={(v) => setExpiresAt(v ?? "")} min={issuedAt || undefined} aria-label={t("app.developer.editor.documents.fields.expiresAt")} />
            </Field>
            <Field label={t("app.developer.editor.documents.fields.description")} htmlFor="doc-desc" className="sm:col-span-2">
              <Textarea id="doc-desc" rows={3} className="min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="gold" loading={saving} disabled={uploads.busy}>
              {t("app.developer.editor.documents.submit")}
            </Button>
          </div>
        </form>
      </FormSection>

      <div>
        <h3 className="mb-3 text-base font-semibold text-stone-100">
          {t("app.developer.editor.documents.list")} <span className="font-mono text-sm text-ink-400">· {docs.length}</span>
        </h3>
        {docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-400">{t("app.developer.editor.documents.empty")}</div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-line bg-ink-900 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <FileTypeIcon mime={d.file?.mime} name={d.file?.originalName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-stone-100">{tr(d.title)}</span>
                        <StatusBadge kind="verification" value={d.status} />
                        <Badge>{label("access", d.access)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
                        <span>{label("documentType", d.type)}</span>
                        {d.number && <span className="font-mono">№ {d.number}</span>}
                        {d.issuedAt && <span>{fmt.date(d.issuedAt)}</span>}
                        {d.file && <span className="font-mono">{fmt.bytes(d.file.size)}</span>}
                      </div>
                      {d.status === "REJECTED" && d.rejectReason && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-danger/25 bg-danger/[0.06] px-2.5 py-1.5 text-xs text-danger">
                          <Warning2 size={14} className="mt-px shrink-0" /> {d.rejectReason}
                        </p>
                      )}
                      {(d.sha256 || d.file?.sha256) && <HashChip value={d.sha256 || d.file!.sha256} className="mt-2" />}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {d.file && (
                        <Tooltip content={t("app.common.download")}>
                          <Button asChild size="icon-sm" variant="ghost" aria-label={t("app.common.download")}>
                            <a href={downloadUrl(d.file.url)} download>
                              <DocumentDownload size={16} />
                            </a>
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content={t("common.actions.delete")}>
                        <Button size="icon-sm" variant="ghost" className="hover:text-danger" onClick={() => setToDelete(d)} aria-label={t("common.actions.delete")}>
                          <Trash size={16} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        tone="danger"
        icon={Trash}
        title={t("app.developer.editor.documents.deleteTitle")}
        description={t("app.developer.editor.documents.deleteText", { title: toDelete ? tr(toDelete.title) : "" })}
        confirmLabel={t("common.actions.delete")}
        onConfirm={remove}
      />
    </div>
  );
}
