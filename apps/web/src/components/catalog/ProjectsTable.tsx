"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Verify } from "iconsax-reactjs";
import type { ProjectCard } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { Progress } from "@/components/ui/progress";
import { ProjectCover } from "./ProjectCover";
import { useFormat } from "./use-format";
import { PAGE_SIZE, type CatalogFilters, type SortKey } from "./filters";

/** List view of the catalog — server-paginated DataTable. */
export function ProjectsTable({
  items,
  total,
  filters,
  loading,
  onChange,
}: {
  items: ProjectCard[];
  total: number;
  filters: CatalogFilters;
  loading?: boolean;
  onChange: (patch: Partial<CatalogFilters>) => void;
}) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const router = useRouter();

  const columns = React.useMemo<Column<ProjectCard>[]>(
    () => [
      {
        key: "project",
        header: t("catalog.table.project"),
        alwaysVisible: true,
        exportValue: (p) => p.name,
        cell: (p) => (
          <div className="flex min-w-56 items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-line">
              <ProjectCover src={p.coverUrl} name={p.name} seed={p.slug} floors={p.floors} showInitial={false} width={480} sizes="48px" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-stone-100">{tr(p.name)}</div>
              <div className="flex items-center gap-1 truncate text-xs text-ink-400">
                {tr(p.developer.name)}
                {p.developer.status === "VERIFIED" && <Verify size={13} variant="Bold" className="shrink-0 text-gold-400" />}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "location",
        header: t("catalog.table.location"),
        hideOnMobile: true,
        exportValue: (p) => [p.region, p.district, p.address].filter(Boolean).join(", "),
        cell: (p) => (
          <div className="max-w-52">
            <div className="truncate text-ink-100">{fmt.region(p.region)}</div>
            <div className="truncate text-xs text-ink-400">{tr(p.district ?? p.address)}</div>
          </div>
        ),
      },
      {
        key: "status",
        header: t("catalog.table.status"),
        exportValue: (p) => label("projectStatus", p.status),
        cell: (p) => <StatusBadge kind="projectStatus" value={p.status} />,
      },
      {
        key: "trust",
        header: t("catalog.table.trust"),
        sortable: true,
        align: "center",
        exportValue: (p) => p.trustScore,
        cell: (p) => <TrustRing score={p.trustScore} size={38} stroke={3.5} />,
      },
      {
        key: "progress",
        header: t("catalog.table.progress"),
        sortable: true,
        hideOnMobile: true,
        exportValue: (p) => p.progress,
        cell: (p) => (
          <div className="w-28">
            <div className="mb-1 text-right font-mono text-xs text-ink-200">{p.progress}%</div>
            <Progress value={p.progress} />
          </div>
        ),
      },
      {
        key: "price",
        header: t("catalog.table.price"),
        sortable: true,
        align: "right",
        exportValue: (p) => p.priceFrom,
        cell: (p) => (
          <span className="whitespace-nowrap font-mono font-medium text-stone-100">
            {p.priceFrom ? fmt.compactMoney(p.priceFrom, p.currency) : "—"}
          </span>
        ),
      },
      {
        key: "units",
        header: t("catalog.table.units"),
        align: "right",
        exportValue: (p) => p.unitsAvailable,
        cell: (p) => (
          <span className="font-mono text-ink-100">
            {p.unitsAvailable}
            <span className="text-ink-400">/{p.unitsTotal}</span>
          </span>
        ),
      },
      {
        key: "completion",
        header: t("catalog.table.completion"),
        hideOnMobile: true,
        exportValue: (p) => p.plannedEndDate,
        cell: (p) => <span className="whitespace-nowrap text-ink-200">{fmt.monthYear(p.plannedEndDate)}</span>,
      },
    ],
    [t, label, tr, fmt],
  );

  const initialSort =
    filters.sort === "price_asc"
      ? ({ key: "price", dir: "asc" } as const)
      : filters.sort === "price_desc"
        ? ({ key: "price", dir: "desc" } as const)
        : filters.sort === "trust"
          ? ({ key: "trust", dir: "desc" } as const)
          : filters.sort === "progress"
            ? ({ key: "progress", dir: "desc" } as const)
            : null;

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={(p) => p.id}
      loading={loading}
      onRowClick={(p) => router.push(`/projects/${p.slug}`)}
      exportName="eka-obyektlar"
      initialSort={initialSort}
      emptyTitle={t("catalog.empty.title")}
      emptyHint={t("catalog.empty.hint")}
      server={{
        total,
        page: filters.page,
        pageSize: PAGE_SIZE,
        onPageChange: (page) => onChange({ page }),
        onSortChange: (s) => {
          let sort: SortKey = "trust";
          if (s?.key === "price") sort = s.dir === "asc" ? "price_asc" : "price_desc";
          else if (s?.key === "progress") sort = "progress";
          onChange({ sort });
        },
      }}
    />
  );
}
