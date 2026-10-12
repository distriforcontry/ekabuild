"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Add, Buildings2 } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";
import { ProjectCover } from "../ui";
import type { DevProject } from "./DevDashboardView";

export function DevProjectsView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<DevProject[]>("/dev/projects", undefined, { select: asList });

  const columns: Column<DevProject>[] = [
    {
      key: "name",
      header: t("app.developer.projects.columns.name"),
      alwaysVisible: true,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <span className="size-12 shrink-0 overflow-hidden rounded-xl border border-line">
            <ProjectCover src={p.coverUrl} alt={tr(p.name)} iconSize={18} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-stone-100">{tr(p.name)}</div>
            <div className="max-w-64 truncate text-xs text-ink-400">{tr([p.region, p.address].filter(Boolean).join(", "))}</div>
          </div>
        </div>
      ),
      sortValue: (p) => p.name,
      exportValue: (p) => p.name,
    },
    {
      key: "status",
      header: t("app.developer.projects.columns.status"),
      cell: (p) => <StatusBadge kind="projectStatus" value={p.status} />,
      sortValue: (p) => p.status,
      exportValue: (p) => label("projectStatus", p.status),
    },
    {
      key: "verification",
      header: t("app.developer.projects.columns.verification"),
      cell: (p) => <StatusBadge kind="verification" value={p.verificationStatus} />,
      sortValue: (p) => p.verificationStatus,
      exportValue: (p) => label("verification", p.verificationStatus),
    },
    {
      key: "published",
      header: t("app.developer.projects.columns.published"),
      cell: (p) => (p.published ? <Badge tone="success" dot>{t("app.developer.projects.published")}</Badge> : <Badge dot>{t("app.developer.projects.draft")}</Badge>),
      sortValue: (p) => (p.published ? 1 : 0),
      exportValue: (p) => (p.published ? "1" : "0"),
      hideOnMobile: true,
    },
    {
      key: "progress",
      header: t("app.developer.projects.columns.progress"),
      cell: (p) => (
        <div className="flex min-w-28 items-center gap-2">
          <Progress value={p.progress} />
          <span className="font-mono text-[11px] text-ink-300">{p.progress}%</span>
        </div>
      ),
      sortValue: (p) => p.progress,
      exportValue: (p) => p.progress,
      hideOnMobile: true,
    },
    {
      key: "units",
      header: t("app.developer.projects.columns.units"),
      align: "right",
      cell: (p) => (
        <span className="font-mono text-sm">
          <span className="text-success">{p.unitsAvailable}</span>
          <span className="text-ink-500"> / </span>
          <span className="text-stone-100">{p.unitsTotal}</span>
        </span>
      ),
      sortValue: (p) => p.unitsTotal,
      exportValue: (p) => `${p.unitsAvailable}/${p.unitsTotal}`,
      hideOnMobile: true,
    },
    {
      key: "trust",
      header: t("app.developer.projects.columns.trust"),
      align: "center",
      cell: (p) => <TrustRing score={p.trustScore} size={38} stroke={3.5} />,
      sortValue: (p) => p.trustScore,
      exportValue: (p) => p.trustScore,
      hideOnMobile: true,
    },
    {
      key: "created",
      header: t("app.developer.projects.columns.created"),
      cell: (p) => <span className="text-xs text-ink-300">{fmt.date(p.createdAt)}</span>,
      sortValue: (p) => (p.createdAt ? new Date(p.createdAt) : null),
      exportValue: (p) => p.createdAt?.slice(0, 10) ?? "",
      hideOnMobile: true,
    },
  ];

  const newButton = (
    <Button asChild variant="gold">
      <Link href="/app/developer/projects/new">
        <Add size={18} /> {t("app.developer.projects.new")}
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.sections.developer")} title={t("app.developer.projects.title")} description={t("app.developer.projects.subtitle")} actions={newButton} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && !(data ?? []).length ? (
        <EmptyState icon={Buildings2} title={t("app.developer.projects.empty")} description={t("app.developer.projects.emptyHint")} action={newButton} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={loading}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/app/developer/projects/${p.id}`)}
          searchText={(p) => `${p.name} ${p.address} ${p.region}`}
          searchPlaceholder={t("app.developer.projects.search")}
          exportName="projects"
        />
      )}
    </div>
  );
}
