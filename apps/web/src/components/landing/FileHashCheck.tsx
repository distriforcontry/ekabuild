"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CloseCircle, DocumentUpload, Refresh, ShieldCross, TickCircle, Warning2 } from "iconsax-reactjs";
import { formatBytes } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/marketing/CopyButton";

type VerifyFileResponse = {
  match: boolean;
  sha256: string;
  document?: { title: string; type: string; status: string; project: { slug: string; name: string } };
};

type State =
  | { kind: "idle" }
  | { kind: "busy"; file: File; phase: "hash" | "check"; hash?: string }
  | { kind: "result"; file: File; res: VerifyFileResponse }
  | { kind: "error"; file: File; hash: string | null }
  | { kind: "invalid"; message: string };

const MAX = 50 * 1024 * 1024;

async function sha256Hex(file: File): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Drop a PDF → hash it locally and ask the registry whether it is the exact registered original. */
export function FileHashCheck({ compact = false }: { compact?: boolean }) {
  const { t, label, tr } = useI18n();
  const [state, setState] = React.useState<State>({ kind: "idle" });
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();

  const run = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setState({ kind: "invalid", message: t("landing.verify.fileOnlyPdf") });
    if (file.size > MAX) return setState({ kind: "invalid", message: t("landing.verify.fileTooLarge") });

    setState({ kind: "busy", file, phase: "hash" });
    const hash = await sha256Hex(file);
    setState({ kind: "busy", file, phase: "check", hash: hash ?? undefined });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<VerifyFileResponse>("/verify/file", fd, { retry: false });
      setState({ kind: "result", file, res: { ...res, sha256: res.sha256 || hash || "" } });
    } catch {
      setState({ kind: "error", file, hash });
    }
  };

  const reset = () => {
    setState({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void run(f);
  };

  const showDrop = state.kind === "idle" || state.kind === "invalid";

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {showDrop ? (
          <motion.div key="drop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <label
              htmlFor={inputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-all duration-300",
                compact ? "py-8" : "py-12",
                drag ? "scale-[1.01] border-gold-400 bg-gold-500/10" : "border-line-strong bg-ink-850/50 hover:border-gold-500/50 hover:bg-gold-500/[0.04]",
              )}
            >
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-2xl border transition-all duration-300",
                  drag ? "border-gold-400 bg-gold-gradient text-onyx" : "border-gold-500/30 bg-gold-500/10 text-gold-300 group-hover:-translate-y-0.5",
                )}
              >
                <DocumentUpload size={26} variant="Bulk" />
              </span>
              <span className="mt-4 text-[15px] font-semibold text-stone-100">{t("landing.verify.fileDrop")}</span>
              <span className="mt-1 text-sm text-gold-300 underline-offset-4 group-hover:underline">{t("landing.verify.fileBrowse")}</span>
              <span className="mt-3 max-w-sm text-xs text-ink-400">{t("landing.verify.fileHint")}</span>
              <input
                id={inputId}
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void run(f);
                }}
              />
            </label>
            {state.kind === "invalid" && (
              <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
                <Warning2 size={16} variant="Bold" />
                {state.message}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
            aria-live="polite"
          >
            {"file" in state && (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-850/60 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/10 font-mono text-[10px] font-bold text-danger">PDF</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-100">{state.file.name}</div>
                  <div className="text-xs text-ink-400">{formatBytes(state.file.size)}</div>
                </div>
                {state.kind !== "busy" && (
                  <button type="button" onClick={reset} aria-label={t("landing.verify.checkAnother")} className="cursor-pointer rounded-lg p-1.5 text-ink-400 transition hover:bg-fg/5 hover:text-stone-100">
                    <CloseCircle size={18} />
                  </button>
                )}
              </div>
            )}

            {state.kind === "busy" && (
              <div className="rounded-2xl border border-line bg-ink-850/40 p-5">
                <div className="flex items-center gap-3 text-sm text-ink-200">
                  <span className="relative grid size-8 place-items-center">
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-ink-600 border-t-gold-400" />
                  </span>
                  {state.phase === "hash" ? t("landing.verify.computing") : t("landing.verify.checking")}
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-fg/8">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-gold-gradient"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                {state.hash && <HashLine hash={state.hash} />}
              </div>
            )}

            {state.kind === "result" && (
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "rounded-2xl border p-5",
                  state.res.match ? "border-success/30 bg-success/[0.07]" : "border-danger/30 bg-danger/[0.07]",
                )}
              >
                <div className="flex items-start gap-4">
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                    className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", state.res.match ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}
                  >
                    {state.res.match ? <TickCircle size={28} variant="Bold" /> : <ShieldCross size={28} variant="Bold" />}
                  </motion.span>
                  <div className="min-w-0">
                    <h4 className={cn("text-base font-semibold", state.res.match ? "text-success" : "text-danger")}>
                      {state.res.match ? t("landing.verify.match") : t("landing.verify.noMatch")}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-ink-300">
                      {state.res.match ? t("landing.verify.matchText") : t("landing.verify.noMatchText")}
                    </p>
                  </div>
                </div>
                {state.res.match && state.res.document && (
                  <div className="mt-4 rounded-xl border border-line bg-ink-900/70 p-4">
                    <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("landing.verify.document")}</div>
                    <div className="mt-1 font-medium text-stone-100">{tr(state.res.document.title)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-300">
                      <span>{label("documentType", state.res.document.type)}</span>
                      <StatusBadge kind="verification" value={state.res.document.status} />
                    </div>
                    {state.res.document.project && (
                      <Link
                        href={`/projects/${state.res.document.project.slug}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 hover:underline"
                      >
                        {t("landing.verify.openProject")}: {tr(state.res.document.project.name)}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                )}
                {state.res.sha256 && <HashLine hash={state.res.sha256} />}
              </motion.div>
            )}

            {state.kind === "error" && (
              <div className="rounded-2xl border border-warning/30 bg-warning/[0.07] p-5">
                <div className="flex items-start gap-3">
                  <Warning2 size={22} variant="Bold" className="mt-0.5 shrink-0 text-warning" />
                  <div>
                    <h4 className="font-semibold text-warning">{t("landing.verify.unavailable")}</h4>
                    <p className="mt-1 text-sm text-ink-300">{t("landing.verify.unavailableText")}</p>
                  </div>
                </div>
                {state.hash && <HashLine hash={state.hash} />}
                <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => void run(state.file)}>
                  <Refresh />
                  {t("common.actions.retry")}
                </Button>
              </div>
            )}

            {state.kind !== "busy" && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <DocumentUpload />
                {t("landing.verify.checkAnother")}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HashLine({ hash }: { hash: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("landing.verify.sha256")}</span>
        <CopyButton value={hash} label={t("landing.common.copyHash")} done={t("landing.common.hashCopied")} />
      </div>
      <code className="block break-all rounded-lg border border-line bg-ink-950/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-gold-200">{hash}</code>
    </div>
  );
}
