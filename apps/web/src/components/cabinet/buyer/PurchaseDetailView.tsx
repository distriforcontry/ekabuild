"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Bag2,
  CloseCircle,
  DocumentText,
  ExportSquare,
  InfoCircle,
  Location,
  PenTool,
  Warning2,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { DocumentItem, FileRef, PurchaseItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilePreviewDialog } from "../FilePreviewDialog";
import { asList, unwrap, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState, ListSkeleton } from "../states";
import { DealDocuments, PaymentSchedule, ReservationCountdown } from "../DealFinance";
import { BackLink, ConfirmDialog, KV, ProjectCover } from "../ui";
import type { MyFilesGroup } from "./DashboardView";
import { DocumentRow } from "./DocumentRow";
import { PurchaseStepper } from "./PurchaseStepper";
import { PageHead } from "../kit";

export function PurchaseDetailView({ id }: { id: string }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { data: purchase, loading, error, reload } = useApi<PurchaseItem>(`/purchases/${id}`, undefined, {
    select: (r) => unwrap<PurchaseItem>(r, "purchase"),
  });
  const unlocked = purchase && (purchase.status === "PAID" || purchase.status === "COMPLETED");
  const files = useApi<MyFilesGroup[]>(unlocked ? "/me/files" : null, undefined, { select: asList });
  const docs = (files.data ?? []).find((g) => g.project.slug === purchase?.project.slug)?.documents ?? [];

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<{ file: FileRef; title: string } | null>(null);

  const cancel = async () => {
    try {
      await api.post(`/purchases/${id}/cancel`);
      toast.success(t("app.purchases.detail.cancel.success"));
      setCancelOpen(false);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    }
  };

  if (loading && !purchase) return <DetailSkeleton />;
  if (error || !purchase) {
    return (
      <div>
        <BackLink href="/app/purchases" label={t("app.purchases.detail.back")} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const p = purchase;
  const canCancel = p.status === "DRAFT" || p.status === "PENDING_SIGNATURES";
  const cancelled = p.status === "CANCELLED";
  const reserved = Boolean(p.reservationUntil) && !p.paidAt && (p.status === "PENDING_SIGNATURES" || p.status === "SIGNED");

  return (
    <div>
      <BackLink href="/app/purchases" label={t("app.purchases.detail.back")} />

      <PageHead
        crumb={p.number}
        eyebrow={`${t("app.meta.purchase")} · ${p.number}`}
        icon={Bag2}
        title={tr(p.project.name)}
        description={t("app.purchases.detail.createdAt", { date: fmt.dateTime(p.createdAt) })}
        meta={
          <>
            <StatusBadge kind="purchaseStatus" value={p.status} />
            <Badge>{label("purchaseKind", p.kind)}</Badge>
          </>
        }
        actions={
          canCancel && (
            <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setCancelOpen(true)}>
              <CloseCircle size={18} /> {t("app.purchases.detail.cancel.button")}
            </Button>
          )
        }
      />

      {/* stepper */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="py-7 md:py-9">
          <PurchaseStepper status={p.status} hasContract={Boolean(p.contract)} />
          <div
            className={cn(
              "mt-7 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              cancelled ? "border-danger/25 bg-danger/[0.06] text-ink-200" : "border-gold-500/20 bg-gold-500/[0.05] text-ink-200",
            )}
          >
            {cancelled ? (
              <Warning2 size={18} variant="Bulk" className="mt-px shrink-0 text-danger" />
            ) : (
              <InfoCircle size={18} variant="Bulk" className="mt-px shrink-0 text-gold-300" />
            )}
            <div>
              {cancelled && <div className="font-semibold text-stone-100">{t("app.purchases.detail.cancelled")}</div>}
              {cancelled ? t("app.purchases.detail.cancelledHint") : t(`app.purchases.detail.next.${p.status}`)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* object & unit */}
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[240px_1fr]">
              <div className="relative aspect-[16/10] md:aspect-auto">
                <ProjectCover src={p.project.coverUrl} alt={tr(p.project.name)} />
              </div>
              <div className="p-5 md:p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("app.purchases.detail.summary")}</div>
                <h2 className="mt-1.5 text-xl font-semibold text-stone-100">{tr(p.project.name)}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-400">
                  <Location size={15} className="shrink-0" /> {tr(p.project.address)}
                </p>
                {p.unit ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { k: t("app.common.unit"), v: `№ ${p.unit.number}` },
                      { k: t("app.common.section"), v: p.unit.section },
                      { k: t("app.common.floor"), v: p.unit.floor },
                      { k: t("app.common.area"), v: fmt.area(p.unit.area) },
                    ].map((x) => (
                      <div key={x.k} className="rounded-xl border border-line bg-ink-850/60 px-3 py-2.5">
                        <div className="text-[11px] text-ink-400">{x.k}</div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-stone-100">{x.v}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl border border-line bg-ink-850/60 px-4 py-3 text-sm text-ink-300">{t("app.purchases.detail.package")}</p>
                )}
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
                  <div>
                    <div className="text-xs text-ink-400">{t("app.purchases.detail.total")}</div>
                    <div className="font-mono text-2xl font-semibold text-stone-100">{fmt.money(p.amount, p.currency)}</div>
                    {p.unit && <div className="text-xs text-ink-400">{label("unitType", p.unit.type)} · {t("app.common.roomsCount", { n: p.unit.rooms })}</div>}
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/projects/${p.project.slug}`}>
                      {t("app.common.viewProject")} <ExportSquare size={14} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* payment schedule (buyer pays the next due instalment here) */}
          {!cancelled && <PaymentSchedule purchase={p} onPaid={() => void reload()} />}

          {/* unlocked documents */}
          {unlocked && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t("app.purchases.detail.documents.title")}</CardTitle>
                  <CardDescription>{t("app.purchases.detail.documents.subtitle")}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/app/files">{t("app.purchases.detail.documents.all")}</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {files.loading ? (
                  <ListSkeleton rows={2} />
                ) : files.error ? (
                  <ErrorState error={files.error} onRetry={files.reload} compact />
                ) : docs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink-400">{t("app.purchases.detail.documents.empty")}</p>
                ) : (
                  docs.map((d: DocumentItem) => (
                    <DocumentRow key={d.id} doc={d} onPreview={(x) => x.file && setPreview({ file: x.file, title: tr(x.title) })} />
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          {reserved && p.reservationUntil && <ReservationCountdown until={p.reservationUntil} />}

          {/* contract */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DocumentText size={18} variant="Bulk" className="text-gold-300" /> {t("app.purchases.detail.contractCard.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {p.contract ? (
                <>
                  <KV
                    items={[
                      { label: t("app.common.number"), value: p.contract.number, mono: true },
                      { label: t("app.common.status"), value: <StatusBadge kind="contractStatus" value={p.contract.status} /> },
                      { label: t("app.purchases.detail.contractCard.signedAt"), value: fmt.date(p.contract.signedAt) },
                    ]}
                  />
                  <Button asChild variant={p.contract.status === "SIGNED" ? "secondary" : "gold"} className="mt-4 w-full">
                    <Link href={`/app/contracts/${p.contract.id}`}>
                      {p.contract.status !== "SIGNED" && p.contract.status !== "CANCELLED" && <PenTool size={16} variant="Bold" />}
                      {t("app.purchases.detail.contractCard.open")}
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-ink-400">{t("app.purchases.detail.contractCard.none")}</p>
              )}
            </CardContent>
          </Card>

          {!cancelled && <DealDocuments purchase={p} />}

          {p.paidAt && (
            <Card>
              <CardContent>
                <KV items={[{ label: t("app.purchases.detail.paidAt"), value: fmt.dateTime(p.paidAt) }]} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        tone="danger"
        icon={Warning2}
        title={t("app.purchases.detail.cancel.confirmTitle")}
        description={t("app.purchases.detail.cancel.confirmText")}
        confirmLabel={t("app.purchases.detail.cancel.confirm")}
        onConfirm={cancel}
      />

      <FilePreviewDialog file={preview?.file ?? null} title={preview?.title} open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
