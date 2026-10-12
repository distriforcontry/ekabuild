"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Add, ClipboardText, Edit2 } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { useFormat } from "./format";
import { useApiList } from "./hooks";
import { Dim, ErrorNotice, OptimisticSwitch, RowActions } from "./primitives";
import type { TemplateItem } from "./types";

export function TemplatesView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const router = useRouter();
  const data = useApiList<TemplateItem>("/admin/templates");

  const columns: Column<TemplateItem>[] = [
    {
      key: "name",
      header: t("admin.templates.columns.name"),
      alwaysVisible: true,
      sortValue: (x) => x.name,
      exportValue: (x) => x.name,
      cell: (x) => (
        <div className="flex min-w-56 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/[0.06] text-gold-300">
            <ClipboardText size={18} variant="Bulk" />
          </span>
          <div className="min-w-0">
            <Link href={`/admin/templates/${x.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-stone-100 hover:text-gold-300">
              {tr(x.name)}
            </Link>
            <div className="line-clamp-1 text-xs text-ink-400">{x.body.replace(/[#*_>|`-]/g, "").slice(0, 90)}</div>
          </div>
        </div>
      ),
    },
    { key: "key", header: t("admin.templates.columns.key"), sortValue: (x) => x.key, exportValue: (x) => x.key, cell: (x) => <span className="font-mono text-xs text-ink-200">{x.key}</span> },
    { key: "kind", header: t("admin.templates.columns.kind"), sortValue: (x) => x.kind, exportValue: (x) => label("purchaseKind", x.kind), cell: (x) => <Badge tone={x.kind === "UNIT" ? "gold" : "info"}>{label("purchaseKind", x.kind)}</Badge> },
    { key: "version", header: t("admin.templates.columns.version"), align: "center", sortValue: (x) => x.version, exportValue: (x) => x.version, cell: (x) => <span className="font-mono text-xs text-ink-300">v{x.version}</span> },
    {
      key: "active",
      header: t("admin.templates.columns.active"),
      align: "center",
      sortValue: (x) => (x.active ? 1 : 0),
      exportValue: (x) => (x.active ? 1 : 0),
      cell: (x) => (
        <OptimisticSwitch
          checked={x.active}
          aria-label={t("admin.templates.columns.active")}
          onChange={async (v) => {
            await api.patch(`/admin/templates/${x.id}`, { active: v });
            data.mutate((items) => items.map((i) => (i.id === x.id ? { ...i, active: v } : i)));
          }}
          successText={(v) => (v ? t("admin.templates.activated") : t("admin.templates.deactivated"))}
        />
      ),
    },
    {
      key: "updatedAt",
      header: t("admin.templates.columns.updated"),
      hideOnMobile: true,
      sortValue: (x) => x.updatedAt ?? x.createdAt ?? "",
      exportValue: (x) => x.updatedAt,
      cell: (x) => <span className="whitespace-nowrap text-xs text-ink-400">{f.date(x.updatedAt ?? x.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (x) => <RowActions actions={[{ label: t("common.actions.edit"), icon: Edit2, onSelect: () => router.push(`/admin/templates/${x.id}`) }]} />,
    },
  ];

  const newButton = (
    <Button variant="gold" asChild>
      <Link href="/admin/templates/new">
        <Add /> {t("admin.templates.new")}
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.sales")} title={t("admin.templates.title")} description={t("admin.templates.description")} actions={newButton} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      {!data.loading && !data.error && data.items.length === 0 ? (
        <EmptyState icon={ClipboardText} title={t("admin.templates.empty")} description={t("admin.templates.emptyHint")} action={newButton} />
      ) : (
        <Dim active={data.refreshing}>
          <DataTable
            columns={columns}
            data={data.items}
            rowKey={(x) => x.id}
            loading={data.initialLoading}
            searchText={(x) => `${x.name} ${x.key}`}
            onRowClick={(x) => router.push(`/admin/templates/${x.id}`)}
            exportName="contract-templates"
            pageSize={20}
          />
        </Dim>
      )}
    </div>
  );
}
