"use client";
import * as React from "react";
import { Building4, ExportSquare } from "iconsax-reactjs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useI18n } from "@/i18n/client";
import { cn, initials } from "@/lib/utils";
import { useFormat } from "../format";
import { TrustCell } from "./Regions";
import { thumb, type DeveloperRow, type TopProject } from "./types";

const tableChrome = "rounded-none border-x-0 border-b-0 bg-transparent shadow-none";

function Rank({ n }: { n: number }) {
  const podium = n <= 3;
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-lg font-mono text-xs font-bold",
        n === 1 ? "bg-gold-gradient text-onyx shadow-[0_4px_14px_-6px_rgb(201_164_100/0.8)]" : podium ? "border border-gold-500/40 bg-gold-500/10 text-gold-200" : "text-ink-400",
      )}
    >
      {n}
    </span>
  );
}

export function DeveloperLeaderboard({ rows }: { rows: DeveloperRow[] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const ranked = React.useMemo(
    () => [...rows].sort((a, b) => b.revenue - a.revenue || b.sold - a.sold || b.avgTrust - a.avgTrust).map((r, i) => ({ ...r, rank: i + 1 })),
    [rows],
  );
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  type R = (typeof ranked)[number];
  const columns: Column<R>[] = [
    { key: "rank", header: t("admin.analytics.developers.rank"), width: "56px", cell: (r) => <Rank n={r.rank} />, sortValue: (r) => r.rank, exportValue: (r) => r.rank, alwaysVisible: true },
    {
      key: "name",
      header: t("admin.analytics.developers.name"),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-[11px] font-bold text-gold-200">{initials(r.name) || "?"}</span>
          <span className="truncate font-medium text-stone-100">{tr(r.name)}</span>
        </span>
      ),
      sortValue: (r) => r.name,
      exportValue: (r) => r.name,
      alwaysVisible: true,
    },
    { key: "projects", header: t("admin.analytics.developers.projects"), align: "right", hideOnMobile: true, cell: (r) => <span className="font-mono">{f.number(r.projects)}</span>, sortValue: (r) => r.projects, exportValue: (r) => r.projects },
    { key: "sold", header: t("admin.analytics.developers.sold"), align: "right", cell: (r) => <span className="font-mono">{f.number(r.sold)}</span>, sortValue: (r) => r.sold, exportValue: (r) => r.sold },
    {
      key: "revenue",
      header: t("admin.analytics.developers.revenue"),
      align: "right",
      cell: (r) => (
        <span className="inline-flex flex-col items-end gap-1">
          <span className="font-mono text-stone-100">{f.compactMoney(r.revenue)}</span>
          <span className="block h-1 w-20 overflow-hidden rounded-full bg-fg/6">
            <span className="block h-full rounded-full bg-gold-400" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
          </span>
        </span>
      ),
      sortValue: (r) => r.revenue,
      exportValue: (r) => r.revenue,
    },
    { key: "avgTrust", header: t("admin.analytics.developers.avgTrust"), align: "right", hideOnMobile: true, cell: (r) => <TrustCell value={r.avgTrust} />, sortValue: (r) => r.avgTrust, exportValue: (r) => Math.round(r.avgTrust) },
    {
      key: "complaints",
      header: t("admin.analytics.developers.complaints"),
      align: "right",
      hideOnMobile: true,
      cell: (r) =>
        r.complaints ? (
          <span className="inline-flex min-w-6 justify-center rounded-full bg-danger/12 px-1.5 py-0.5 font-mono text-xs font-semibold text-danger">{r.complaints}</span>
        ) : (
          <span className="font-mono text-ink-500">0</span>
        ),
      sortValue: (r) => r.complaints,
      exportValue: (r) => r.complaints,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={ranked}
      rowKey={(r) => r.id}
      exportName="analytics-developers"
      emptyTitle={t("admin.analytics.developers.empty")}
      initialSort={{ key: "rank", dir: "asc" }}
      pageSize={10}
      className={tableChrome}
    />
  );
}

export function TopProjectsTable({ rows }: { rows: TopProject[] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const maxConv = Math.max(1, ...rows.map((r) => r.conversion));
  const columns: Column<TopProject>[] = [
    {
      key: "name",
      header: t("admin.analytics.projects.name"),
      cell: (r) => (
        <a
          href={`/projects/${r.slug}`}
          target="_blank"
          rel="noopener"
          className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-gold-400"
          title={t("admin.analytics.projects.open")}
        >
          <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-800">
            {r.coverUrl ? (
              <img src={thumb(r.coverUrl)!} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-110" />
            ) : (
              <Building4 size={18} variant="Bulk" className="absolute inset-0 m-auto text-ink-500" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate font-medium text-stone-100 transition group-hover:text-gold-200">
              <span className="truncate">{tr(r.name)}</span>
              <ExportSquare size={12} className="shrink-0 opacity-0 transition group-hover:opacity-70" />
            </span>
            <span className="block truncate font-mono text-[11px] text-ink-400">/{r.slug}</span>
          </span>
        </a>
      ),
      sortValue: (r) => r.name,
      exportValue: (r) => r.name,
      alwaysVisible: true,
    },
    { key: "views", header: t("admin.analytics.projects.views"), align: "right", cell: (r) => <span className="font-mono">{f.number(r.views)}</span>, sortValue: (r) => r.views, exportValue: (r) => r.views },
    { key: "purchases", header: t("admin.analytics.projects.purchases"), align: "right", hideOnMobile: true, cell: (r) => <span className="font-mono">{f.number(r.purchases)}</span>, sortValue: (r) => r.purchases, exportValue: (r) => r.purchases },
    {
      key: "conversion",
      header: t("admin.analytics.projects.conversion"),
      align: "right",
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-fg/6 sm:block">
            <span className="block h-full rounded-full" style={{ width: `${(r.conversion / maxConv) * 100}%`, background: "var(--chart-5)" }} />
          </span>
          <span className="w-12 text-right font-mono text-stone-100">{r.conversion >= 10 ? Math.round(r.conversion) : r.conversion.toFixed(1)}%</span>
        </span>
      ),
      sortValue: (r) => r.conversion,
      exportValue: (r) => r.conversion,
    },
    { key: "trust", header: t("admin.analytics.projects.trust"), align: "right", hideOnMobile: true, cell: (r) => <TrustCell value={r.trustScore} />, sortValue: (r) => r.trustScore, exportValue: (r) => r.trustScore },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.slug}
      exportName="analytics-top-projects"
      emptyTitle={t("admin.analytics.projects.empty")}
      initialSort={{ key: "views", dir: "desc" }}
      pageSize={10}
      className={tableChrome}
    />
  );
}
