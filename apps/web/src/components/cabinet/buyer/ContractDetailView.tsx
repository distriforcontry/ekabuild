"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { Clock, FingerScan, Printer, ShieldTick, TickCircle, Verify } from "iconsax-reactjs";
import type { SignerRole } from "@eka/shared";
import { LogoMark } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { SignDialog } from "@/components/eimzo/SignDialog";
import { useI18n } from "@/i18n/client";
import type { ContractDetail, SignatureItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { unwrap, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";
import { BackLink, CopyButton, KV } from "../ui";

const SLOTS: SignerRole[] = ["BUYER", "SELLER"];

export function ContractDetailView({ id }: { id: string }) {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { user } = useCabinetUser();
  const { data: contract, loading, error, reload, setData } = useApi<ContractDetail>(`/contracts/${id}`, undefined, {
    select: (r) => unwrap<ContractDetail>(r, "contract"),
  });
  const [signOpen, setSignOpen] = React.useState(false);

  if (loading && !contract) return <ContractSkeleton />;
  if (error || !contract) {
    return (
      <div>
        <BackLink href="/app/contracts" label={t("app.contracts.detail.back")} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const c = contract;
  const sigOf = (role: SignerRole) => c.signatures.find((s) => s.role === role) ?? null;
  const fullySigned = c.status === "SIGNED";
  const back = user.role === "DEVELOPER" && c.viewerRole === "SELLER" ? "/app/developer/sales" : "/app/contracts";

  return (
    <div>
      <BackLink href={back} label={back === "/app/contracts" ? t("app.contracts.detail.back") : t("app.developer.sales.title")} />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge kind="contractStatus" value={c.status} />
            <Badge tone="gold">
              <ShieldTick variant="Bold" /> E-IMZO
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100 md:text-3xl">{tr(c.title)}</h1>
          <p className="mt-1.5 text-sm text-ink-400">
            <span className="font-mono text-ink-200">№ {c.number}</span> · {fmt.date(c.createdAt)} ·{" "}
            <Link href={`/app/purchases/${c.purchase.id}`} className="text-gold-300 underline-offset-4 hover:underline">
              {t("app.contracts.detail.purchase")} {c.purchase.number}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={18} /> {t("app.contracts.detail.print")}
          </Button>
          {c.canSign && (
            <Button variant="gold" onClick={() => setSignOpen(true)}>
              <FingerScan size={18} variant="Bold" /> {t("app.contracts.detail.sign")}
            </Button>
          )}
        </div>
      </div>

      {/* status banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "mb-6 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center md:p-5 print:hidden",
          c.canSign
            ? "border-gold-500/35 bg-gold-500/[0.06]"
            : fullySigned
              ? "border-success/30 bg-success/[0.06]"
              : "border-line bg-ink-900",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            c.canSign ? "bg-gold-gradient text-onyx shadow-glow" : fullySigned ? "bg-success/15 text-success" : "bg-ink-800 text-ink-300",
          )}
        >
          {c.canSign ? <FingerScan size={20} variant="Bold" /> : fullySigned ? <Verify size={20} variant="Bold" /> : <Clock size={20} variant="Bulk" />}
        </span>
        <div className="flex-1">
          <div className="font-semibold text-stone-100">
            {c.canSign ? t("app.contracts.detail.yourTurn") : fullySigned ? t("app.contracts.detail.signedAll") : t("app.contracts.detail.waitingOther")}
          </div>
          <div className="text-sm text-ink-300">
            {c.canSign ? t("app.contracts.detail.yourTurnHint") : fullySigned ? t("app.contracts.detail.signedAllHint") : null}
          </div>
        </div>
        {c.canSign && (
          <Button variant="gold" onClick={() => setSignOpen(true)}>
            {t("app.contracts.detail.sign")}
          </Button>
        )}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* paper */}
        <article className="relative overflow-hidden rounded-2xl border border-line-strong bg-ink-900 shadow-lift">
          <div className="h-1 bg-gold-gradient" />
          <div className="bg-noise pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035]" aria-hidden>
            <LogoMark className="h-[520px]" />
          </div>
          <div className="relative px-6 py-8 sm:px-10 md:px-14 md:py-12">
            <header className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <LogoMark className="h-12" />
                <div className="leading-tight">
                  <div className="text-sm font-extrabold tracking-[0.18em] text-stone-100">
                    EKA<span className="text-gold-400"> BUILD</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">{t("app.contracts.detail.documentLabel")}</div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-right">
                <dt className="text-ink-400">{t("app.contracts.detail.number")}</dt>
                <dd className="font-mono text-stone-100">{c.number}</dd>
                <dt className="text-ink-400">{t("app.contracts.detail.date")}</dt>
                <dd className="text-stone-100">{fmt.date(c.createdAt)}</dd>
              </dl>
            </header>

            <div className="prose-eka mt-8 max-w-none font-[450] [&_h1]:text-center [&_h1]:text-[32px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
            </div>

            <footer className="mt-12 grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
              {SLOTS.map((role) => {
                const s = sigOf(role);
                return (
                  <div key={role} className="relative">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">{t(`app.common.${role === "BUYER" ? "buyer" : "seller"}`)}</div>
                    <div className="mt-2 min-h-6 text-sm text-stone-100">{s?.signerName ?? "—"}</div>
                    <div className="mt-6 flex items-end gap-3 border-b border-dashed border-line-strong pb-1">
                      {s ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gold-300">
                          <ShieldTick size={14} variant="Bold" /> {t(`app.contracts.detail.signatures.method.${s.method}`)} · {fmt.dateTime(s.signedAt)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-500">{t("app.contracts.detail.signatures.waiting")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </footer>
            <div className="mt-8 break-all font-mono text-[10px] leading-relaxed text-ink-500">SHA-256 · {c.bodyHash}</div>
          </div>
        </article>

        {/* side */}
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start print:hidden">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t("app.contracts.detail.signatures.title")}</CardTitle>
                <CardDescription>{t("app.contracts.detail.signatures.subtitle")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {SLOTS.map((role) => (
                <SignatureSlot
                  key={role}
                  role={role}
                  sig={sigOf(role)}
                  canSignHere={c.canSign && c.viewerRole === role}
                  onSign={() => setSignOpen(true)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FingerScan size={18} variant="Bulk" className="text-gold-300" />
                {t("app.contracts.detail.hash.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2 rounded-xl border border-line bg-ink-850 p-3">
                <code className="flex-1 break-all font-mono text-[11px] leading-relaxed text-gold-200">{c.bodyHash}</code>
                <CopyButton text={c.bodyHash} toastText={t("app.common.copied")} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">{t("app.contracts.detail.hash.explain")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <KV
                items={[
                  { label: t("app.common.project"), value: tr(c.purchase.project.name) },
                  {
                    label: t("app.common.unit"),
                    value: c.purchase.unit
                      ? t("app.common.unitShort", { section: c.purchase.unit.section, floor: c.purchase.unit.floor, number: c.purchase.unit.number })
                      : t("app.purchases.package"),
                  },
                  { label: t("app.common.amount"), value: fmt.money(c.purchase.amount, c.purchase.currency), mono: true },
                  { label: t("app.common.buyer"), value: c.purchase.buyerOrg ? tr(c.purchase.buyerOrg.name) : c.purchase.buyer.fullName },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <SignDialog
        contractId={c.id}
        contractNumber={c.number}
        open={signOpen}
        onOpenChange={setSignOpen}
        expected={{ pinfl: user.pinfl, tin: user.organization?.tin }}
        onSigned={(next) => {
          if (next && typeof next === "object" && "signatures" in next) setData(next);
          else void reload();
          router.refresh();
        }}
      />
    </div>
  );
}

function SignatureSlot({ role, sig, canSignHere, onSign }: { role: SignerRole; sig: SignatureItem | null; canSignHere: boolean; onSign: () => void }) {
  const { t, label } = useI18n();
  const fmt = useFmt();
  if (!sig) {
    return (
      <div className={cn("rounded-xl border border-dashed p-4", canSignHere ? "border-gold-500/50 bg-gold-500/[0.04]" : "border-line-strong")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label("signerRole", role)}</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-300">
              <Clock size={15} className="text-warning" /> {t("app.contracts.detail.signatures.waiting")}
            </div>
          </div>
          {canSignHere && (
            <Button size="sm" variant="gold" onClick={onSign}>
              <FingerScan size={14} variant="Bold" /> {t("app.eimzo.sign")}
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-success/25 bg-success/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label("signerRole", role)}</div>
          <div className="mt-1 truncate text-sm font-semibold text-stone-100">{sig.signerName ?? "—"}</div>
        </div>
        <Badge tone={sig.verified ? "success" : "warning"}>
          {sig.verified ? <TickCircle variant="Bold" /> : <Clock variant="Bold" />}
          {sig.verified ? t("app.contracts.detail.signatures.verified") : t("app.contracts.detail.signatures.notVerified")}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {sig.signerTin && (
          <>
            <dt className="text-ink-400">{t("app.contracts.detail.signatures.tin")}</dt>
            <dd className="text-right font-mono text-ink-100">{sig.signerTin}</dd>
          </>
        )}
        {sig.signerPinfl && (
          <>
            <dt className="text-ink-400">{t("app.contracts.detail.signatures.pinfl")}</dt>
            <dd className="text-right font-mono text-ink-100">{sig.signerPinfl}</dd>
          </>
        )}
        {sig.certSerial && (
          <>
            <dt className="text-ink-400">{t("app.contracts.detail.signatures.serial")}</dt>
            <dd className="truncate text-right font-mono text-ink-100">{sig.certSerial}</dd>
          </>
        )}
        {sig.certValidTo && (
          <>
            <dt className="text-ink-400">{t("app.contracts.detail.signatures.validTo")}</dt>
            <dd className="text-right text-ink-100">{fmt.date(sig.certValidTo)}</dd>
          </>
        )}
        <dt className="text-ink-400">{t("app.contracts.detail.signatures.signedAt")}</dt>
        <dd className="text-right text-ink-100">{fmt.dateTime(sig.signedAt)}</dd>
      </dl>
      <div className="mt-3 border-t border-line pt-2 text-[11px] text-ink-400">{t(`app.contracts.detail.signatures.method.${sig.method}`)}</div>
    </motion.div>
  );
}

function ContractSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 rounded-2xl border border-line bg-ink-900 p-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-3.5", i % 3 === 2 ? "w-2/3" : "w-full")} />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
