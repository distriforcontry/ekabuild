"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, DocumentText, Hashtag, ScanBarcode, SearchNormal1, ShieldCross, Warning2 } from "iconsax-reactjs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { CertificateItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/components/marketing/format";
import { FileHashCheck } from "./FileHashCheck";

type Tab = "code" | "number" | "file";

/** Certificate verification: by public code (→ /verify/[code]), by number (inline results) or by PDF hash. */
export function VerifyWidget({ tabs = ["code", "file"], defaultTab = "code", initialNumber = "" }: { tabs?: Tab[]; defaultTab?: Tab; initialNumber?: string }) {
  const { t } = useI18n();
  const [tab, setTab] = React.useState<Tab>(defaultTab);
  const labels: Record<Tab, { label: string; Icon: typeof ScanBarcode }> = {
    code: { label: t("landing.verify.tabCode"), Icon: ScanBarcode },
    number: { label: t("landing.verify.tabNumber"), Icon: Hashtag },
    file: { label: t("landing.verify.tabFile"), Icon: DocumentText },
  };

  return (
    <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as Tab)}>
      <TabsPrimitive.List className="relative flex w-full gap-1 rounded-2xl border border-line bg-ink-850/70 p-1" aria-label={t("landing.verify.title")}>
        {tabs.map((k) => {
          const { label, Icon } = labels[k];
          const active = tab === k;
          return (
            <TabsPrimitive.Trigger
              key={k}
              value={k}
              className={cn(
                "relative flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                active ? "text-onyx" : "text-ink-300 hover:text-stone-100",
              )}
            >
              {active && (
                <motion.span layoutId={`verify-tab-${tabs.join("")}`} className="absolute inset-0 rounded-xl bg-gold-gradient shadow-glow" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <Icon size={17} variant={active ? "Bold" : "Linear"} className="relative" />
              <span className="relative truncate">{label}</span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      <div className="mt-6">
        <TabsPrimitive.Content value="code" className="focus-visible:outline-none">
          <CodeForm />
        </TabsPrimitive.Content>
        {tabs.includes("number") && (
          <TabsPrimitive.Content value="number" className="focus-visible:outline-none">
            <NumberSearch initial={initialNumber} />
          </TabsPrimitive.Content>
        )}
        <TabsPrimitive.Content value="file" className="focus-visible:outline-none">
          <FileHashCheck />
        </TabsPrimitive.Content>
      </div>
    </TabsPrimitive.Root>
  );
}

function CodeForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    router.push(`/verify/${encodeURIComponent(c)}`);
  };

  return (
    <form onSubmit={submit}>
      <Label htmlFor={id}>{t("landing.verify.codeLabel")}</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ScanBarcode size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("landing.verify.codePlaceholder", { example: "EKA-7K2P-9QXA" })}
            autoComplete="off"
            spellCheck={false}
            className="h-12 pl-11 font-mono text-[15px] tracking-wide"
          />
        </div>
        <Button type="submit" variant="gold" size="lg" className="h-12" loading={busy} disabled={!code.trim()}>
          {!busy && <SearchNormal1 />}
          {t("landing.verify.submit")}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-400">{t("landing.verify.codeHint")}</p>
    </form>
  );
}

type NumberResult = {
  certificate: CertificateItem;
  project: { slug: string; name: string; address: string; region: string; developer: { name: string; tin: string; status: string } };
  document: { title: string; sha256: string } | null;
};

function NumberSearch({ initial }: { initial: string }) {
  const { t, label, tr, locale } = useI18n();
  const [q, setQ] = React.useState(initial);
  const [state, setState] = React.useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; items: NumberResult[] } | { kind: "error" }>({ kind: "idle" });
  const id = React.useId();

  const search = React.useCallback(async (value: string) => {
    const n = value.trim();
    if (!n) return;
    setState({ kind: "loading" });
    try {
      const res = await api.get<{ items: NumberResult[] }>("/verify", { query: { number: n }, retry: false });
      setState({ kind: "done", items: res?.items ?? [] });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  React.useEffect(() => {
    if (initial.trim()) void search(initial);
  }, [initial, search]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <Label htmlFor={id}>{t("landing.verify.numberLabel")}</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Hashtag size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              id={id}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("landing.verify.numberPlaceholder", { example: "RN-2024/01543" })}
              autoComplete="off"
              spellCheck={false}
              className="h-12 pl-11 font-mono text-[15px]"
            />
          </div>
          <Button type="submit" variant="gold" size="lg" className="h-12" loading={state.kind === "loading"} disabled={!q.trim()}>
            {state.kind !== "loading" && <SearchNormal1 />}
            {t("landing.verify.submit")}
          </Button>
        </div>
      </form>

      <div className="mt-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {state.kind === "loading" && (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </motion.div>
          )}
          {state.kind === "error" && (
            <motion.div key="e" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/[0.07] p-4">
              <Warning2 size={20} variant="Bold" className="mt-0.5 shrink-0 text-warning" />
              <div>
                <div className="font-semibold text-warning">{t("landing.common.loadError")}</div>
                <p className="mt-0.5 text-sm text-ink-300">{t("landing.common.loadErrorText")}</p>
              </div>
            </motion.div>
          )}
          {state.kind === "done" && state.items.length === 0 && (
            <motion.div key="n" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/[0.07] p-4">
              <ShieldCross size={20} variant="Bold" className="mt-0.5 shrink-0 text-danger" />
              <div>
                <div className="font-semibold text-danger">{t("landing.verify.numberEmpty")}</div>
                <p className="mt-0.5 text-sm text-ink-300">{t("landing.verify.numberEmptyText")}</p>
              </div>
            </motion.div>
          )}
          {state.kind === "done" && state.items.length > 0 && (
            <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">{t("landing.verify.numberResults", { count: state.items.length })}</div>
              <ul className="space-y-3">
                {state.items.map((r, i) => (
                  <motion.li key={r.certificate.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Link
                      href={`/verify/${encodeURIComponent(r.certificate.code)}`}
                      className="group flex items-center gap-4 rounded-2xl border border-line bg-ink-850/50 p-4 transition hover:border-gold-500/40 hover:bg-ink-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-stone-100">{r.certificate.number}</span>
                          <StatusBadge kind="certificateStatus" value={r.certificate.status} />
                        </div>
                        <div className="mt-1 text-sm text-ink-300">{label("certificateType", r.certificate.type)}</div>
                        <div className="mt-1 truncate text-xs text-ink-400">
                          {tr(r.project?.name)} · {tr(r.certificate.issuer)} · {fmtDate(r.certificate.issuedAt, locale)}
                        </div>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-ink-400 transition group-hover:translate-x-1 group-hover:text-gold-300" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
