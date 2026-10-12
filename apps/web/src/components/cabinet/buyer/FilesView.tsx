"use client";
import * as React from "react";
import Link from "next/link";
import { ExportSquare, Folder2, FolderOpen, SearchNormal1 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { useI18n } from "@/i18n/client";
import type { DocumentItem, FileRef } from "@/lib/types";
import { FilePreviewDialog } from "../FilePreviewDialog";
import { asList, useApi } from "../hooks";
import { ErrorState, ListSkeleton } from "../states";
import type { MyFilesGroup } from "./DashboardView";
import { DocumentRow } from "./DocumentRow";

export function FilesView() {
  const { t, tr } = useI18n();
  const { data, loading, error, reload } = useApi<MyFilesGroup[]>("/me/files", undefined, { select: asList });
  const [q, setQ] = React.useState("");
  const [preview, setPreview] = React.useState<{ file: FileRef; title: string } | null>(null);

  const groups = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data ?? [])
      .map((g) => ({
        ...g,
        documents: query ? g.documents.filter((d) => `${d.title} ${d.number ?? ""} ${d.file?.originalName ?? ""}`.toLowerCase().includes(query)) : g.documents,
      }))
      .filter((g) => g.documents.length > 0);
  }, [data, q]);

  const onPreview = (d: DocumentItem) => d.file && setPreview({ file: d.file, title: tr(d.title) });

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.area")} title={t("app.files.title")} description={t("app.files.subtitle")} />
      {loading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Folder2}
          title={t("app.files.empty")}
          description={t("app.files.emptyHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/app/purchases">{t("app.shell.nav.purchases")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="relative max-w-sm">
            <SearchNormal1 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("app.files.search")}
              aria-label={t("app.files.search")}
              className="h-11 w-full rounded-xl border border-line bg-ink-850 pl-10 pr-3 text-sm text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10"
            />
          </div>
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">{t("common.table.empty")}</p>
          ) : (
            groups.map((g, gi) => (
              <Reveal key={g.project.slug} delay={gi * 0.05} y={14}>
                <section className="rounded-2xl border border-line bg-ink-900 shadow-card">
                  <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                    <span className="grid size-10 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                      <FolderOpen size={20} variant="Bulk" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold text-stone-100">{tr(g.project.name)}</h2>
                      <p className="text-xs text-ink-400">{t("app.files.count", { n: g.documents.length })}</p>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/projects/${g.project.slug}`}>
                        {t("app.common.viewProject")} <ExportSquare size={14} />
                      </Link>
                    </Button>
                  </header>
                  <div className="space-y-2 p-3 md:p-4">
                    {g.documents.map((d) => (
                      <DocumentRow key={d.id} doc={d} onPreview={onPreview} />
                    ))}
                  </div>
                </section>
              </Reveal>
            ))
          )}
        </div>
      )}
      <FilePreviewDialog file={preview?.file ?? null} title={preview?.title} open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}
