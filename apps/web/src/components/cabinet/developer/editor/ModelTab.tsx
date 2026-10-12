"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { DocumentDownload, ExportSquare, I3DRotate, I3Dcube } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { downloadUrl } from "../../FilePreviewDialog";
import { FileDrop, UploadList, useUploads } from "../../FileDrop";
import { useFmt } from "../../format";
import { HashChip } from "../../ui";
import { FormSection } from "./fields";

export function ModelTab({ projectId, detail, onChanged }: { projectId: string; detail: ProjectDetail | null; onChanged: () => Promise<void> | void }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const uploads = useUploads();
  const [saving, setSaving] = React.useState(false);
  const model = detail?.model3d ?? null;

  const onFiles = async (files: File[]) => {
    const [res] = await uploads.add(files.slice(0, 1), true);
    if (!res) return;
    setSaving(true);
    try {
      await api.post(`/dev/projects/${projectId}/model3d`, { fileId: res.id });
      toast.success(t("app.developer.editor.model.success"));
      uploads.reset();
      await onChanged();
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FormSection title={t("app.developer.editor.model.title")} description={t("app.developer.editor.model.subtitle")}>
        <FileDrop onFiles={(f) => void onFiles(f)} accept=".glb,.gltf" types="GLB, GLTF" disabled={uploads.busy || saving} />
        {uploads.items.length > 0 && <UploadList items={uploads.items} onRemove={uploads.remove} className="mt-4" />}
      </FormSection>

      <section className="relative overflow-hidden rounded-2xl border border-line bg-ink-900 p-6 shadow-card">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative flex h-full flex-col items-center justify-center py-6 text-center">
          <motion.span
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="grid size-24 place-items-center rounded-3xl border border-gold-500/30 bg-gold-500/10 text-gold-300 [transform-style:preserve-3d]"
          >
            <I3Dcube size={44} variant="Bulk" />
          </motion.span>
          {model ? (
            <>
              <div className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("app.developer.editor.model.current")}</div>
              <div className="mt-1.5 max-w-full truncate font-semibold text-stone-100">{model.originalName}</div>
              <div className="mt-1 font-mono text-xs text-ink-400">{fmt.bytes(model.size)}</div>
              <HashChip value={model.sha256} className="mt-3" />
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {detail?.slug && (
                  <Button asChild size="sm">
                    <Link href={`/app/studio/${detail.slug}`} title={t("app.developer.editor.model.openStudioHint")}>
                      <I3Dcube size={16} variant="Bulk" /> {t("app.developer.editor.model.openStudio")}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="secondary" size="sm">
                  <a href={downloadUrl(model.url)} download>
                    <DocumentDownload size={16} /> {t("app.common.download")}
                  </a>
                </Button>
                {detail?.slug && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/projects/${detail.slug}`} target="_blank">
                      <I3DRotate size={16} /> {t("app.developer.editor.viewPublic")} <ExportSquare size={14} />
                    </Link>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 font-semibold text-stone-100">{t("app.developer.editor.model.none")}</div>
              <p className="mt-1 max-w-sm text-sm text-ink-400">{t("app.developer.editor.model.noneHint")}</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
