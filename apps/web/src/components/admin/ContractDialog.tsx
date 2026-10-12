"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExportSquare, ShieldTick, TickCircle, Warning2 } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { ContractDetail } from "@/lib/types";
import { cabinetUrl, useFormat } from "./format";
import { useApi } from "./hooks";
import { CopyChip, ErrorNotice } from "./primitives";

/** Read-only contract viewer for admins: rendered body, hash, signatures. */
export function ContractDialog({ contractId, onClose }: { contractId: string | null; onClose: () => void }) {
  const { t, label } = useI18n();
  const f = useFormat();
  const { data, loading, error, reload } = useApi<ContractDetail>(contractId ? `/contracts/${contractId}` : null);
  const c = contractId && data?.id === contractId ? data : null;

  return (
    <Dialog open={Boolean(contractId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="flex max-h-[92vh] flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            {t("admin.purchases.contract.title")} {c && <span className="font-mono text-gold-300">№ {c.number}</span>}
            {c && <StatusBadge kind="contractStatus" value={c.status} />}
          </DialogTitle>
          <DialogDescription>{c ? c.title : loading ? t("common.actions.loading") : ""}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
          {!c ? (
            !error && (
              <div className="space-y-3 px-6 pb-6">
                <Skeleton className="h-6 w-2/3" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[1fr_260px]">
              <article className="prose-eka min-w-0 rounded-2xl border border-line bg-ink-850/60 p-5 text-sm md:p-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
              </article>
              <aside className="space-y-5">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{t("admin.purchases.contract.hash")}</div>
                  <CopyChip value={c.bodyHash} display={`${c.bodyHash.slice(0, 20)}…`} className="w-full justify-start py-1.5" />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{t("admin.purchases.contract.signatures")}</div>
                  {c.signatures.length === 0 ? (
                    <p className="text-sm text-ink-400">{t("admin.purchases.contract.noSignatures")}</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {c.signatures.map((s) => (
                        <li key={s.id} className="rounded-xl border border-line bg-ink-850 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gold-200">{label("signerRole", s.role)}</span>
                            {s.verified ? (
                              <Badge tone="success">
                                <ShieldTick variant="Bold" /> {t("admin.purchases.contract.verified")}
                              </Badge>
                            ) : (
                              <Badge tone="warning">
                                <Warning2 variant="Bold" /> {t("admin.purchases.contract.unverified")}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1.5 text-sm text-stone-100">{s.signerName ?? "—"}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-ink-400">{s.signerTin ?? s.signerPinfl ?? ""}</div>
                          {s.certSerial && <div className="mt-0.5 font-mono text-[10px] text-ink-500">{t("admin.purchases.contract.cert", { serial: s.certSerial })}</div>}
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-400">
                            <TickCircle size={12} /> {f.dateTime(s.signedAt)} · {s.method}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button variant="secondary" className="w-full" asChild>
                  <a href={cabinetUrl(`/app/contracts/${c.id}`)} target="_blank" rel="noopener">
                    <ExportSquare /> {t("admin.purchases.contract.openCabinet")}
                  </a>
                </Button>
              </aside>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
