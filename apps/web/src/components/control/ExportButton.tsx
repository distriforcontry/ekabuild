"use client";
import * as React from "react";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import {
  Award,
  Buildings2,
  Building4,
  DocumentDownload,
  DocumentText,
  Flag,
  Grid5,
  People,
  Receipt2,
  ShieldSearch,
  TableDocument,
  WalletMoney,
} from "iconsax-reactjs";
import { toast } from "sonner";
import { useApi } from "@/components/admin/hooks";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";
import { cn } from "@/lib/utils";
import { apiBase, DEV_EXPORTS, exportHref, type Area, type ExportFilters } from "./area";

/** Drop empty filters and the list-only keys the export endpoint does not understand. */
function clean(filters: ExportFilters) {
  const out: ExportFilters = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === "") continue;
    if (["page", "pageSize", "sort", "order"].includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * "Excel" button: a plain same-origin download link (the API answers with Content-Disposition: attachment),
 * carrying the list's current filters (q, status, from, to, archived…).
 */
export function ExcelButton({
  area,
  entity,
  filters = {},
  size = "sm",
  variant = "secondary",
  className,
  label,
}: {
  area: Area;
  entity: string;
  filters?: ExportFilters;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  const href = exportHref(area, entity, clean(filters));
  return (
    <Tooltip content={t("admin.control.excelHint")}>
      <Button asChild size={size} variant={variant} className={cn("shrink-0", className)}>
        <a href={href} download onClick={() => toast(t("admin.control.excelStarted"), { duration: 2200 })} data-export={entity}>
          <TableDocument variant="Bulk" className="text-success" />
          {label ?? t("admin.control.excel")}
        </a>
      </Button>
    </Tooltip>
  );
}

const ENTITY_ICON: Record<string, IconType> = {
  projects: Building4,
  units: Grid5,
  purchases: Receipt2,
  payments: WalletMoney,
  certificates: Award,
  documents: DocumentText,
  users: People,
  organizations: Buildings2,
  complaints: Flag,
  audit: ShieldSearch,
};

/** Dialog listing every exportable registry (from GET /admin/export or the developer scope), with an optional period. */
export function ExportCenter({ area, className }: { area: Area; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const list = useApi<string[]>(open ? `${apiBase(area)}/export` : null);
  const entities = list.data ?? (area === "dev" ? [...DEV_EXPORTS] : null);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className={className}>
        <DocumentDownload variant="Bulk" className="text-gold-300" /> {t("admin.control.exportCenter.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="flex max-h-[92vh] flex-col">
          <DialogHeader className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-success/30 bg-success/10 text-success">
              <TableDocument size={22} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{t("admin.control.exportCenter.title")}</DialogTitle>
              <DialogDescription>{t("admin.control.exportCenter.description")}</DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-4 rounded-2xl border border-line bg-ink-850/60 p-3.5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{t("admin.control.exportCenter.period")}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <DatePicker value={from} onChange={setFrom} max={to ?? undefined} aria-label={t("admin.control.exportCenter.from")} placeholder={t("admin.control.exportCenter.from")} />
                <DatePicker value={to} onChange={setTo} min={from ?? undefined} aria-label={t("admin.control.exportCenter.to")} placeholder={t("admin.control.exportCenter.to")} />
              </div>
            </div>
            {!entities ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[68px] rounded-2xl" />
                ))}
              </div>
            ) : entities.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">{t("admin.control.exportCenter.empty")}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {entities.map((e, i) => {
                  const Icon = ENTITY_ICON[e] ?? TableDocument;
                  const key = `admin.control.exportCenter.entities.${e}` as const;
                  const title = t(`${key}.title` as MessageKey);
                  return (
                    <motion.li key={e} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.35 }}>
                      <a
                        href={exportHref(area, e, clean({ from, to }))}
                        download
                        data-export={e}
                        className="group flex items-center gap-3 rounded-2xl border border-line bg-ink-900 p-3 transition hover:-translate-y-px hover:border-success/35 hover:bg-success/[0.04]"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/10 text-gold-300 transition group-hover:border-success/30 group-hover:bg-success/10 group-hover:text-success">
                          <Icon size={18} variant="Bulk" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-100">{title.startsWith("admin.") ? e : title}</span>
                          <span className="block truncate text-xs text-ink-400">{t(`${key}.hint` as MessageKey).replace(/^admin\..*/, ".xlsx")}</span>
                        </span>
                        <DocumentDownload size={18} className="shrink-0 text-ink-400 transition group-hover:translate-y-0.5 group-hover:text-success" />
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </DialogBody>
          <DialogFooter className="items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <ShieldSearch size={14} className="shrink-0 text-gold-300" /> {t("admin.control.exportCenter.audited")}
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
