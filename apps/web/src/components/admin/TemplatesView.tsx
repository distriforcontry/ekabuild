"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Add, ClipboardText, DocumentCopy, Edit2, InfoCircle, TickCircle, Clock } from "iconsax-reactjs";
import { Segmented } from "@/components/control/ui";
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
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<"all" | "contracts" | "annexes">("all");
  const isAnnex = (x: TemplateItem) => x.key.startsWith("annex-");
  const annexes = data.items.filter(isAnnex);
  const contracts = data.items.filter((x) => !isAnnex(x));
  const rows = tab === "annexes" ? annexes : tab === "contracts" ? contracts : data.items;
  const latest = data.items.reduce<TemplateItem | null>((m, x) => (!m || (x.updatedAt ?? "") > (m.updatedAt ?? "") ? x : m), null);

  const columns: Column<TemplateItem>[] = [
    {
      key: "name",
      header: t("admin.templates.columns.name"),
      alwaysVisible: true,
      sortValue: (x) => x.name,
      exportValue: (x) => x.name,
      cell: (x) => (
        <div className="flex min-w-56 items-center gap-3">
          <span
            className={
              isAnnex(x)
                ? "grid size-10 shrink-0 place-items-center rounded-xl border border-info/25 bg-info/10 text-info"
                : "grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/[0.06] text-gold-300"
            }
          >
            {isAnnex(x) ? <DocumentCopy size={18} variant="Bulk" /> : <ClipboardText size={18} variant="Bulk" />}
          </span>
          <div className="min-w-0">
            <Link href={`/admin/templates/${x.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-stone-100 hover:text-gold-300">
              {tr(x.name)}
            </Link>
            <div className="line-clamp-1 text-xs text-ink-400">{x.body.replace(/\{\{\s*[\w.]+\s*\}\}/g, "…").replace(/[#*_>|`-]/g, "").slice(0, 90)}</div>
          </div>
        </div>
      ),
    },
    { key: "key", header: t("admin.templates.columns.key"), sortValue: (x) => x.key, exportValue: (x) => x.key, cell: (x) => <span className="whitespace-nowrap font-mono text-xs text-ink-200">{x.key}</span> },
    {
      key: "kind",
      header: t("admin.templates.columns.kind"),
      sortValue: (x) => x.kind,
      exportValue: (x) => label("purchaseKind", x.kind),
      cell: (x) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={isAnnex(x) ? "info" : "gold"}>{isAnnex(x) ? t("admin.control.templates.annex") : t("admin.control.templates.contract")}</Badge>
          <span className="text-xs text-ink-400">{label("purchaseKind", x.kind)}</span>
        </div>
      ),
    },
    {
      key: "version",
      header: t("admin.templates.columns.version"),
      align: "center",
      sortValue: (x) => x.version,
      exportValue: (x) => x.version,
      cell: (x) => <span className="inline-flex rounded-md border border-line bg-fg/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-200">v{x.version}</span>,
    },
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
      {data.items.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[
            { label: t("admin.control.templates.stats.total"), value: data.items.length, icon: ClipboardText },
            { label: t("admin.control.templates.stats.active"), value: data.items.filter((x) => x.active).length, icon: TickCircle },
            { label: t("admin.control.templates.stats.annexes"), value: annexes.length, icon: DocumentCopy },
            { label: t("admin.control.templates.stats.latest"), value: latest ? f.date(latest.updatedAt ?? latest.createdAt) : "—", icon: Clock, small: true },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex items-center gap-3 bg-ink-900 px-4 py-3.5"
            >
              <k.icon size={20} variant="Bulk" className="shrink-0 text-gold-300" />
              <div className="min-w-0">
                <div className="truncate text-[11px] uppercase tracking-wider text-ink-400">{k.label}</div>
                <div className={k.small ? "truncate text-sm font-semibold text-stone-100" : "font-mono text-lg font-semibold text-stone-100"}>{k.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          size="md"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: t("admin.control.templates.tabs.all"), count: data.items.length },
            { value: "contracts", label: t("admin.control.templates.tabs.contracts"), count: contracts.length },
            { value: "annexes", label: t("admin.control.templates.tabs.annexes"), count: annexes.length },
          ]}
        />
        <p className="flex max-w-xl items-start gap-1.5 text-xs text-ink-400">
          <InfoCircle size={14} variant="Bulk" className="mt-px shrink-0 text-info" /> {t("admin.control.templates.annexHint")}
        </p>
      </div>
      {!data.loading && !data.error && data.items.length === 0 ? (
        <EmptyState icon={ClipboardText} title={t("admin.templates.empty")} description={t("admin.templates.emptyHint")} action={newButton} />
      ) : (
        <Dim active={data.refreshing}>
          <DataTable
            columns={columns}
            data={rows}
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
