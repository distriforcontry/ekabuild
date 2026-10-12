"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown2, CloseCircle, Link21, ShieldSearch, ShieldTick, Unlimited } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/misc";
import { CountUp } from "@/components/ui/reveal";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { AuditItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { entityLabel } from "./AdminDashboard";
import { shortHash, useFormat } from "./format";
import { useApiList, useListState } from "./hooks";
import { Avatar, CopyChip, Dim, ErrorNotice, FilterSelect, ResetFilters, SearchBox } from "./primitives";
import type { AuditVerifyResult } from "./types";

const FILTERS = ["entity"] as const;
const ENTITIES = [
  "User",
  "Organization",
  "Project",
  "Unit",
  "Document",
  "Certificate",
  "CadastreCheck",
  "Inspection",
  "Purchase",
  "Contract",
  "ContractTemplate",
  "Rule",
  "Complaint",
  "SupportThread",
  "Session",
];

type VerifyState = { phase: "idle" } | { phase: "running" } | { phase: "done"; result: AuditVerifyResult } | { phase: "error"; message: string };

export function AuditView() {
  const { t } = useI18n();
  const f = useFormat();
  const sp = useSearchParams();
  const list = useListState(FILTERS);
  const data = useApiList<AuditItem>("/admin/audit", list.apiQuery);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [verify, setVerify] = React.useState<VerifyState>({ phase: "idle" });

  const runVerify = React.useCallback(async () => {
    setVerify({ phase: "running" });
    const started = Date.now();
    try {
      const result = await api.get<AuditVerifyResult>("/admin/audit/verify");
      // keep the scanning animation visible for a moment — it's a reassuring ritual
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      setVerify({ phase: "done", result });
    } catch (e) {
      setVerify({ phase: "error", message: errorMessage(e) });
    }
  }, []);

  const autoRan = React.useRef(false);
  const updateUrl = list.update;
  React.useEffect(() => {
    if (!autoRan.current && sp.get("verify") === "1") {
      autoRan.current = true;
      runVerify();
      updateUrl({ verify: null }, { resetPage: false });
    }
  }, [sp, runVerify, updateUrl]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Chain continuity is only meaningful for the unfiltered, default-ordered log
  const contiguous = !list.filters.entity && !list.q && !list.sort;
  const linkState = (row: AuditItem, index: number): "linked" | "gap" | "mismatch" => {
    const older = data.items[index + 1];
    if (!older || !contiguous) return "gap";
    return row.prevHash === older.hash ? "linked" : "mismatch";
  };

  const columns: Column<AuditItem>[] = [
    {
      key: "createdAt",
      header: t("admin.audit.columns.time"),
      exportValue: (a) => a.createdAt,
      cell: (a) => (
        <div className="whitespace-nowrap">
          <div className="text-xs text-ink-100">{f.dateTime(a.createdAt)}</div>
          <div className="text-[11px] text-ink-500">{f.relative(a.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "actor",
      header: t("admin.audit.columns.actor"),
      exportValue: (a) => a.actor?.fullName ?? t("admin.audit.system"),
      cell: (a) => (
        <div className="flex min-w-40 items-center gap-2.5">
          {a.actor ? <Avatar name={a.actor.fullName} size={28} /> : <span className="grid size-7 place-items-center rounded-lg border border-line bg-ink-800 text-ink-400"><Unlimited size={14} /></span>}
          <div className="min-w-0">
            <div className="truncate text-sm text-ink-100">{a.actor?.fullName ?? t("admin.audit.system")}</div>
            {a.actor?.phone && <div className="truncate font-mono text-[10px] text-ink-500">{a.actor.phone}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: t("admin.audit.columns.action"),
      alwaysVisible: true,
      exportValue: (a) => `${a.action} ${a.entity} ${a.entityId ?? ""}`,
      cell: (a) => {
        const open = expanded.has(a.id);
        const hasMeta = a.meta != null && !(typeof a.meta === "object" && Object.keys(a.meta as object).length === 0);
        return (
          <div className="min-w-64 max-w-xl">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(a.id);
              }}
              aria-expanded={open}
              className="group flex w-full cursor-pointer items-center gap-2 text-left"
            >
              <span className="rounded-md border border-gold-500/20 bg-gold-500/[0.07] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gold-200">{a.action}</span>
              <span className="text-sm text-ink-200">{entityLabel(t, a.entity)}</span>
              {a.entityId && <span className="truncate font-mono text-[11px] text-ink-500">#{a.entityId.length > 12 ? `…${a.entityId.slice(-10)}` : a.entityId}</span>}
              <ArrowDown2 size={14} className={cn("ml-auto shrink-0 text-ink-500 transition group-hover:text-stone-100", open && "rotate-180 text-gold-300")} />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                  <div className="mt-2.5 space-y-2">
                    {hasMeta ? <JsonView value={a.meta} /> : <div className="text-xs text-ink-500">{t("admin.audit.noMeta")}</div>}
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <CopyChip value={a.hash} display={`${t("admin.audit.hash")}: ${shortHash(a.hash, 16)}…`} />
                      <CopyChip value={a.prevHash} display={`${t("admin.audit.prev")}: ${shortHash(a.prevHash, 16)}…`} />
                      {a.entityId && <CopyChip value={a.entityId} display={`ID: ${a.entityId}`} />}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      },
    },
    { key: "ip", header: t("admin.audit.columns.ip"), hideOnMobile: true, exportValue: (a) => a.ip, cell: (a) => <span className="font-mono text-[11px] text-ink-400">{a.ip ?? "—"}</span> },
    {
      key: "chain",
      header: t("admin.audit.columns.chain"),
      exportValue: (a) => `${a.prevHash} -> ${a.hash}`,
      cell: (a, i) => <ChainCell row={a} state={linkState(a, i)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.system")}
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
        actions={
          <Button variant="gold" onClick={runVerify} loading={verify.phase === "running"}>
            {verify.phase !== "running" && <ShieldTick variant="Bold" />} {t("admin.audit.verify")}
          </Button>
        }
      />

      <VerifyPanel state={verify} onClose={() => setVerify({ phase: "idle" })} />
      <ErrorNotice error={data.error} onRetry={data.reload} />

      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(a) => String(a.id)}
          loading={data.initialLoading}
          server={list.server(data.total)}
          dense
          exportName="audit-log"
          emptyTitle={t("admin.audit.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.entity}
                onChange={(v) => list.update({ entity: v })}
                placeholder={t("admin.audit.filters.entity")}
                options={ENTITIES.map((e) => ({ value: e, label: entityLabel(t, e), description: e }))}
              />
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
            </>
          }
        />
      </Dim>
    </div>
  );
}

function ChainCell({ row, state }: { row: AuditItem; state: "linked" | "gap" | "mismatch" }) {
  const { t } = useI18n();
  const tip = state === "linked" ? t("admin.audit.linked") : state === "mismatch" ? t("admin.audit.mismatch") : t("admin.audit.gap");
  return (
    <div className="flex items-center gap-3">
      <div className="relative pl-4 font-mono text-[11px] leading-none">
        <span className={cn("absolute left-[3px] top-[7px] h-[calc(100%-14px)] w-px", state === "mismatch" ? "bg-danger/60" : "bg-gold-500/40")} aria-hidden />
        <div className="relative flex items-center gap-1.5 pb-2 text-ink-500" title={row.prevHash}>
          <span className="absolute -left-4 top-0.5 size-[7px] rounded-full border border-ink-500 bg-ink-900" />
          {shortHash(row.prevHash)}
        </div>
        <div className="relative flex items-center gap-1.5 text-gold-200" title={row.hash}>
          <span className="absolute -left-4 top-0.5 size-[7px] rounded-full bg-gold-400 shadow-[0_0_8px_rgb(212_175_106/0.6)]" />
          {shortHash(row.hash)}
        </div>
      </div>
      <Tooltip content={tip}>
        <span
          className={cn(
            "grid size-6 place-items-center rounded-md border",
            state === "linked" ? "border-success/30 bg-success/10 text-success" : state === "mismatch" ? "border-danger/30 bg-danger/10 text-danger" : "border-line text-ink-500",
          )}
          aria-label={tip}
        >
          {state === "mismatch" ? <CloseCircle size={12} /> : <Link21 size={12} />}
        </span>
      </Tooltip>
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  // light syntax colouring without dependencies
  const html = React.useMemo(
    () =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (m, str, colon, kw, num) => {
          if (str) return colon ? `<span class="text-gold-300">${str}</span>${colon}` : `<span class="text-success">${str}</span>`;
          if (kw) return `<span class="text-info">${kw}</span>`;
          if (num) return `<span class="text-warning">${num}</span>`;
          return m;
        }),
    [text],
  );
  return (
    <pre
      className="max-h-72 overflow-auto rounded-xl border border-line bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed text-ink-200"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function VerifyPanel({ state, onClose }: { state: VerifyState; onClose: () => void }) {
  const { t } = useI18n();
  const show = state.phase !== "idle";
  const ok = state.phase === "done" && state.result.ok;
  const bad = (state.phase === "done" && !state.result.ok) || state.phase === "error";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "relative mb-6 overflow-hidden rounded-2xl border p-5 md:p-6",
              ok ? "border-success/30 bg-success/[0.06]" : bad ? "border-danger/30 bg-danger/[0.06]" : "border-gold-500/25 bg-gold-500/[0.05]",
            )}
          >
            {state.phase === "running" && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-gold-400/15 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "400%" }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              />
            )}
            <div className="relative flex items-center gap-5">
              <div className="relative grid size-16 shrink-0 place-items-center">
                {state.phase === "running" ? (
                  <>
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-gold-500/20 border-t-gold-400" />
                    <ShieldSearch size={26} variant="Bulk" className="text-gold-300" />
                  </>
                ) : (
                  <svg viewBox="0 0 64 64" className={cn("size-16", ok ? "text-success" : "text-danger")} aria-hidden>
                    <motion.circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.35" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
                    {ok ? (
                      <motion.path d="M20 33l8 8 16-17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.45 }} />
                    ) : (
                      <motion.path d="M23 23l18 18M41 23L23 41" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.45 }} />
                    )}
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {state.phase === "running" && (
                  <>
                    <div className="text-base font-semibold text-stone-100">{t("admin.audit.verifying")}</div>
                    <div className="mt-1 text-sm text-ink-300">{t("admin.audit.verifyingHint")}</div>
                  </>
                )}
                {state.phase === "done" && state.result.ok && (
                  <>
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-semibold text-success">{t("admin.audit.ok")}</span>
                      <span className="font-mono text-2xl font-semibold text-stone-100">
                        <CountUp value={state.result.checked} duration={1.2} />
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-ink-300">{t("admin.audit.okDesc", { count: state.result.checked })}</div>
                  </>
                )}
                {state.phase === "done" && !state.result.ok && (
                  <>
                    <div className="text-lg font-semibold text-danger">{t("admin.audit.broken")}</div>
                    <div className="mt-1 text-sm text-ink-300">{t("admin.audit.brokenDesc", { id: state.result.brokenAt ?? "?" })}</div>
                    <div className="mt-2 font-mono text-xs text-ink-400">{t("admin.audit.checked", { count: state.result.checked })}</div>
                  </>
                )}
                {state.phase === "error" && (
                  <>
                    <div className="text-lg font-semibold text-danger">{t("admin.audit.verifyFailed")}</div>
                    <div className="mt-1 font-mono text-xs text-ink-400">{state.message}</div>
                  </>
                )}
              </div>
              {state.phase !== "running" && (
                <button type="button" onClick={onClose} className="cursor-pointer self-start rounded-lg p-1.5 text-ink-400 transition hover:bg-fg/5 hover:text-stone-100" aria-label={t("common.actions.close")}>
                  <CloseCircle size={18} />
                </button>
              )}
            </div>
            <p className="relative mt-4 border-t border-line pt-3 text-xs text-ink-400">
              <span className="font-semibold text-ink-200">{t("admin.audit.chainTitle")}.</span> {t("admin.audit.chainHint")}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
