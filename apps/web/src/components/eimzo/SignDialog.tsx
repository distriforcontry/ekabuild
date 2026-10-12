"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Building,
  Code,
  Danger,
  DocumentText,
  ExportSquare,
  Key,
  Refresh,
  SearchStatus,
  ShieldTick,
  TickCircle,
  Devices,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import type { ContractDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createPkcs7, EimzoError, installApiKeys, listCertificates, loadKey, unloadKey, version, type EimzoCertificate } from "./eimzo-client";
import { SealStamp } from "./SealStamp";

type Challenge = { data: string; text: string; mode: "EIMZO" | "MOCK" };
type Phase = "challenge" | "mock" | "detect" | "missing" | "certs" | "signing" | "done" | "error";

const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date | null) => (d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "—");

/** UTF-8 safe base64 */
function b64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/**
 * Signs a contract: fetches the exact payload (challenge), then either a demo signature (MOCK mode)
 * or a real PKCS#7 through the locally installed E-IMZO app, and posts it to the API.
 */
export function SignDialog({
  contractId,
  contractNumber,
  open,
  onOpenChange,
  onSigned,
  expected,
}: {
  contractId: string;
  contractNumber: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSigned: (c: ContractDetail) => void;
  /** viewer identifiers — certificates that match get a badge */
  expected?: { tin?: string | null; pinfl?: string | null };
}) {
  const { t } = useI18n();
  const [phase, setPhase] = React.useState<Phase>("challenge");
  const [challenge, setChallenge] = React.useState<Challenge | null>(null);
  const [certs, setCerts] = React.useState<EimzoCertificate[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [ver, setVer] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [signedAt, setSignedAt] = React.useState<Date | null>(null);
  const busy = phase === "signing" || phase === "challenge" || phase === "detect";

  const friendly = React.useCallback(
    (e: unknown): string => {
      if (e instanceof EimzoError) {
        if (e.kind === "API_KEY") return t("app.eimzo.errors.apiKey");
        if (e.kind === "PASSWORD") return t("app.eimzo.errors.password");
        if (e.kind === "CANCELLED") return t("app.eimzo.errors.cancelled");
        if (e.kind === "NOT_RUNNING" || e.kind === "TIMEOUT") return t("app.eimzo.errors.connection");
        return t("app.eimzo.errors.generic", { reason: e.message });
      }
      if (e instanceof ApiError) {
        if (e.status === 0) return t("common.errors.network");
        return t("app.eimzo.errors.server", { reason: e.message || e.code });
      }
      return t("common.errors.generic");
    },
    [t],
  );

  const detect = React.useCallback(async () => {
    setPhase("detect");
    setError(null);
    try {
      const v = await version();
      setVer(`${v.major}.${v.minor}`);
    } catch {
      setPhase("missing");
      return;
    }
    try {
      await installApiKeys();
      const list = await listCertificates();
      list.sort((a, b) => Number(a.expired) - Number(b.expired));
      setCerts(list);
      const firstValid = list.find((c) => !c.expired);
      setSelected(firstValid ? `${firstValid.disk}|${firstValid.path}|${firstValid.name}` : null);
      setPhase("certs");
    } catch (e) {
      setError(friendly(e));
      setPhase("error");
    }
  }, [friendly]);

  const start = React.useCallback(async () => {
    setPhase("challenge");
    setError(null);
    try {
      const c = await api.get<Challenge>(`/contracts/${contractId}/challenge`);
      setChallenge(c);
      if (c.mode === "MOCK") setPhase("mock");
      else await detect();
    } catch (e) {
      setError(friendly(e));
      setPhase("error");
    }
  }, [contractId, detect, friendly]);

  React.useEffect(() => {
    if (open) void start();
    else {
      setPhase("challenge");
      setChallenge(null);
      setCerts([]);
      setError(null);
    }
  }, [open, start]);

  const submit = async (method: "EIMZO" | "MOCK", pkcs7: string) => {
    const res = await api.post<ContractDetail | { contract: ContractDetail }>(`/contracts/${contractId}/sign`, { method, pkcs7 });
    const contract = (res && typeof res === "object" && "contract" in res ? res.contract : res) as ContractDetail;
    setSignedAt(new Date());
    setPhase("done");
    onSigned(contract);
  };

  const signMock = async () => {
    if (!challenge) return;
    setPhase("signing");
    setError(null);
    try {
      const pkcs7 = b64(JSON.stringify({ mock: true, data: challenge.data, signedAt: new Date().toISOString() }));
      await submit("MOCK", pkcs7);
    } catch (e) {
      setError(friendly(e));
      setPhase("mock");
    }
  };

  const signEimzo = async () => {
    const cert = certs.find((c) => `${c.disk}|${c.path}|${c.name}` === selected);
    if (!challenge || !cert) return;
    setPhase("signing");
    setError(null);
    let keyId: string | null = null;
    try {
      keyId = await loadKey(cert);
      const pkcs7 = await createPkcs7(challenge.data, keyId);
      await submit("EIMZO", pkcs7);
    } catch (e) {
      setError(friendly(e));
      setPhase("certs");
    } finally {
      if (keyId) void unloadKey(keyId);
    }
  };

  const matches = (c: EimzoCertificate) =>
    Boolean((expected?.pinfl && c.pinfl === expected.pinfl) || (expected?.tin && c.tin === expected.tin));

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="lg" className="flex max-h-[92vh] flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow">
              <ShieldTick size={20} variant="Bold" />
            </span>
            <div>
              <DialogTitle>{t("app.eimzo.title")}</DialogTitle>
              <DialogDescription className="font-mono text-xs">{t("app.eimzo.subtitle", { number: contractNumber })}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {(phase === "challenge" || phase === "detect") && (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="relative grid size-16 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold-400/50" />
                    {phase === "detect" ? <SearchStatus size={28} variant="Bulk" /> : <Spinner className="size-6" />}
                  </span>
                  <p className="mt-5 text-sm text-ink-300">{phase === "detect" ? t("app.eimzo.detecting") : t("app.eimzo.loading")}</p>
                </div>
              )}

              {phase === "mock" && challenge && (
                <div className="space-y-5">
                  <div className="flex gap-3 rounded-xl border border-dashed border-gold-500/40 bg-gold-500/[0.06] p-4">
                    <Code size={20} variant="Bulk" className="mt-0.5 shrink-0 text-gold-300" />
                    <div>
                      <div className="text-sm font-semibold text-stone-100">{t("app.eimzo.mock.title")}</div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-300">{t("app.eimzo.mock.text")}</p>
                    </div>
                  </div>
                  <Payload text={challenge.text} />
                  <InlineError message={error} />
                </div>
              )}

              {phase === "missing" && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center">
                    <span className="grid size-16 place-items-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
                      <Devices size={28} variant="Bulk" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-stone-100">{t("app.eimzo.notInstalled.title")}</h3>
                    <p className="mt-1 max-w-md text-sm text-ink-300">{t("app.eimzo.notInstalled.text")}</p>
                  </div>
                  <ol className="space-y-2.5">
                    {(["step1", "step2", "step3"] as const).map((k, i) => (
                      <li key={k} className="flex items-start gap-3 rounded-xl border border-line bg-ink-850/60 px-4 py-3 text-sm text-ink-200">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-500/15 font-mono text-xs font-bold text-gold-300">{i + 1}</span>
                        {t(`app.eimzo.notInstalled.${k}`)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {phase === "certs" && (
                <div className="space-y-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-stone-100">{t("app.eimzo.certs.title")}</div>
                      <div className="text-xs text-ink-400">{t("app.eimzo.certs.subtitle")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ver && <Badge tone="success">{t("app.eimzo.certs.version", { version: ver })}</Badge>}
                      <Button size="icon-sm" variant="ghost" onClick={() => void detect()} aria-label={t("app.eimzo.notInstalled.retry")}>
                        <Refresh size={16} />
                      </Button>
                    </div>
                  </div>
                  {certs.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
                      <Key size={26} variant="Bulk" className="text-gold-300" />
                      <div className="mt-3 font-semibold text-stone-100">{t("app.eimzo.certs.empty")}</div>
                      <p className="mt-1 max-w-sm text-sm text-ink-400">{t("app.eimzo.certs.emptyHint")}</p>
                    </div>
                  ) : (
                    <div role="radiogroup" className="grid gap-2.5">
                      {certs.map((c) => {
                        const key = `${c.disk}|${c.path}|${c.name}`;
                        const active = selected === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={c.expired}
                            onClick={() => setSelected(key)}
                            className={cn(
                              "relative flex w-full cursor-pointer items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200",
                              active ? "border-gold-400/70 bg-gold-500/[0.07] shadow-glow" : "border-line bg-ink-850/60 hover:border-line-strong",
                              c.expired && "cursor-not-allowed opacity-50 hover:border-line",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-10 shrink-0 place-items-center rounded-xl",
                                active ? "bg-gold-gradient text-onyx" : "border border-line bg-ink-800 text-ink-300",
                              )}
                            >
                              <Key size={18} variant={active ? "Bold" : "Linear"} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold uppercase tracking-wide text-stone-100">{c.cn}</span>
                                {c.expired && <Badge tone="danger">{t("app.eimzo.certs.expired")}</Badge>}
                                {!c.expired && matches(c) && (
                                  <Badge tone="success">
                                    <TickCircle variant="Bold" /> {t("app.eimzo.certs.match")}
                                  </Badge>
                                )}
                              </span>
                              {(c.org || c.title) && (
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-300">
                                  <Building size={13} className="shrink-0" />
                                  <span className="truncate">{[c.org, c.title].filter(Boolean).join(" · ")}</span>
                                </span>
                              )}
                              <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-400">
                                {c.tin && (
                                  <span>
                                    {t("app.contracts.detail.signatures.tin")} {c.tin}
                                  </span>
                                )}
                                {c.pinfl && (
                                  <span>
                                    {t("app.contracts.detail.signatures.pinfl")} {c.pinfl}
                                  </span>
                                )}
                                {c.serial && <span>#{c.serial}</span>}
                                <span className={c.expired ? "text-danger" : "text-ink-300"}>{t("app.eimzo.certs.validTo", { date: dmy(c.validTo) })}</span>
                              </span>
                            </span>
                            <span
                              className={cn(
                                "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
                                active ? "border-gold-400" : "border-line-strong",
                              )}
                            >
                              {active && <motion.span layoutId="cert-dot" className="size-2.5 rounded-full bg-gold-400" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {challenge && <Payload text={challenge.text} />}
                  <InlineError message={error} />
                </div>
              )}

              {phase === "signing" && (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="relative grid size-16 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold-400/60" />
                    <Spinner className="size-6" />
                  </span>
                  <p className="mt-5 font-semibold text-stone-100">{t("app.eimzo.signing")}</p>
                  {challenge?.mode === "EIMZO" && <p className="mt-1 text-sm text-ink-400">{t("app.eimzo.passwordHint")}</p>}
                </div>
              )}

              {phase === "done" && (
                <div className="flex flex-col items-center py-4 text-center">
                  <SealStamp label={t("app.eimzo.success.stamp")} date={signedAt ? dmy(signedAt) : undefined} />
                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 font-display text-3xl font-medium text-stone-100"
                  >
                    {t("app.eimzo.success.title")}
                  </motion.h3>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="mt-1 text-sm text-ink-300">
                    {t("app.eimzo.success.text")}
                  </motion.p>
                </div>
              )}

              {phase === "error" && (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="grid size-16 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
                    <Danger size={28} variant="Bulk" />
                  </span>
                  <p className="mt-4 max-w-md text-sm text-ink-200">{error}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </DialogBody>

        <DialogFooter className="flex-wrap">
          {phase === "done" ? (
            <Button variant="gold" onClick={() => onOpenChange(false)}>
              {t("common.actions.close")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("common.actions.cancel")}
              </Button>
              {phase === "mock" && (
                <Button variant="gold" onClick={signMock}>
                  <ShieldTick size={18} variant="Bold" /> {t("app.eimzo.mock.button")}
                </Button>
              )}
              {phase === "missing" && (
                <>
                  <Button asChild variant="secondary">
                    <a href="https://e-imzo.soliq.uz" target="_blank" rel="noreferrer">
                      {t("app.eimzo.notInstalled.install")} <ExportSquare size={16} />
                    </a>
                  </Button>
                  <Button variant="gold" onClick={() => void detect()}>
                    <Refresh size={16} /> {t("app.eimzo.notInstalled.retry")}
                  </Button>
                </>
              )}
              {phase === "certs" && (
                <Button variant="gold" onClick={signEimzo} disabled={!selected}>
                  {t("app.eimzo.sign")} <ArrowRight size={16} />
                </Button>
              )}
              {phase === "error" && (
                <Button variant="gold" onClick={() => void start()}>
                  <Refresh size={16} /> {t("common.actions.retry")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Payload({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <details className="group rounded-xl border border-line bg-ink-850/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-ink-200 [&::-webkit-details-marker]:hidden">
        <DocumentText size={16} variant="Bulk" className="text-gold-300" />
        <span className="flex-1">{t("app.eimzo.whatYouSign")}</span>
        <ArrowRight size={14} className="transition group-open:rotate-90" />
      </summary>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-300">
        {text}
      </pre>
    </details>
  );
}

function InlineError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          role="alert"
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger">
            <Danger size={18} variant="Bulk" className="mt-px shrink-0" />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
