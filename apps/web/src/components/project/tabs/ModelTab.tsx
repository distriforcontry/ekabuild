"use client";
import Link from "next/link";
import { DocumentDownload, I3DCubeScan, I3DRotate, InfoCircle } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { IS_DEMO } from "@/lib/static";
import { BuildingViewer } from "@/components/three/BuildingViewer";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "../ProjectProvider";
import { ShaChip, downloadUrl } from "../bits";

export function ModelTab() {
  const { project: p } = useProject();
  const { t } = useI18n();
  const fmt = useFormat();
  const m = p.model3d;

  return (
    <div className="space-y-4">
      <BuildingViewer
        model3d={m}
        massing={p.massing}
        floors={p.floors}
        progress={p.progress}
        name={p.name}
        className="h-[min(78vh,640px)] min-h-[440px]"
      />
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-ink-900/80 p-5 shadow-card md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/8 text-gold-300">
            {m ? <I3DCubeScan size={19} variant="Bulk" /> : <InfoCircle size={19} variant="Bulk" />}
          </span>
          <div>
            <div className="font-semibold text-stone-100">{t("catalog.viewer.aboutTitle")}</div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-300">
              {m ? t("catalog.viewer.aboutUploaded") : t("catalog.viewer.aboutProcedural")}
            </p>
            <p className="mt-2 hidden text-xs text-ink-400 md:block">{t("catalog.viewer.hint")}</p>
          </div>
        </div>
        {m && (
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="text-xs text-ink-400">
              {t("catalog.viewer.fileInfo")}: <span className="text-ink-200">{m.originalName}</span> · <span className="font-mono">{fmt.bytes(m.size)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* the 3D Studio lives in the cabinet — not part of the static demo */}
              {!IS_DEMO && (
                <Button size="sm" asChild>
                  <Link href={`/app/studio/${p.slug}`} title={t("catalog.viewer.openStudioHint")}>
                    <I3DRotate size={15} variant="Bulk" />
                    {t("catalog.viewer.openStudio")}
                  </Link>
                </Button>
              )}
              <ShaChip sha={m.sha256} />
              <Button variant="secondary" size="sm" asChild>
                <a href={downloadUrl(m)}>
                  <DocumentDownload size={15} />
                  {t("catalog.file.download")}
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
