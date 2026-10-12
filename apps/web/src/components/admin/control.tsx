"use client";
import * as React from "react";
import { Archive, ArchiveBook, Lock1, ShieldCross, Unlock } from "iconsax-reactjs";
import { toast } from "sonner";
import { Segmented } from "@/components/control/ui";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { ControlFlags } from "@/lib/types";
import { useFormat } from "./format";
import type { ConfirmOptions, RowAction } from "./primitives";

/* ───────────────────────────── list view tabs (archived / blocked) ───────────────────────────── */

export type ArchiveView = "active" | "archived" | "all" | "blocked";

/** Current view from the list's URL filters (`archived` absent → active, `1` → archived, `all`; `blocked=1`). */
export function archiveViewOf(filters: { archived?: string | null; blocked?: string | null }): ArchiveView {
  if (filters.blocked === "1") return "blocked";
  if (filters.archived === "1") return "archived";
  if (filters.archived === "all") return "all";
  return "active";
}

/** URL patch for a view (blocked organisations are listed whether archived or not). */
export function archiveViewPatch(v: ArchiveView): Record<string, string | null> {
  return {
    archived: v === "archived" ? "1" : v === "all" || v === "blocked" ? "all" : null,
    blocked: v === "blocked" ? "1" : null,
  };
}

export function ArchiveTabs({ value, onChange, withBlocked }: { value: ArchiveView; onChange: (v: ArchiveView) => void; withBlocked?: boolean }) {
  const { t } = useI18n();
  const opts: { value: ArchiveView; label: React.ReactNode }[] = [
    { value: "active", label: t("admin.control.archive.tabs.active") },
    { value: "archived", label: t("admin.control.archive.tabs.archived") },
    ...(withBlocked ? [{ value: "blocked" as const, label: t("admin.control.archive.tabs.blocked") }] : []),
    { value: "all", label: t("admin.control.archive.tabs.all") },
  ];
  return <Segmented value={value} onChange={onChange} options={opts} label={t("admin.control.archive.tabsLabel")} size="md" />;
}

/* ───────────────────────────── badges ───────────────────────────── */

/** "Bloklangan" / "Arxivda" pills; the reason and date live in a tooltip. */
export function ControlBadges({ row, className }: { row: ControlFlags & { status?: string }; className?: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const blocked = Boolean(row.blockedAt) || row.status === "BLOCKED";
  if (!blocked && !row.archivedAt) return null;
  return (
    <span className={className ?? "inline-flex flex-wrap items-center gap-1"}>
      {blocked && (
        <Tooltip
          content={
            <span className="block max-w-64">
              <span className="block font-semibold text-stone-100">{row.blockReason ? t("admin.control.block.badgeTip", { reason: row.blockReason }) : t("admin.control.block.noReason")}</span>
              {row.blockedAt && <span className="mt-0.5 block text-ink-400">{t("admin.control.block.since", { date: f.date(row.blockedAt) })}</span>}
            </span>
          }
        >
          <span tabIndex={0} className="inline-flex cursor-help rounded-full focus-visible:outline-2 focus-visible:outline-gold-400" onClick={(e) => e.stopPropagation()}>
            <Badge tone="danger" className="px-2 py-px text-[10px]">
              <ShieldCross variant="Bold" /> {t("admin.control.block.badge")}
            </Badge>
          </span>
        </Tooltip>
      )}
      {row.archivedAt && (
        <Tooltip content={t("admin.control.archive.badgeTip", { date: f.date(row.archivedAt) })}>
          <span tabIndex={0} className="inline-flex cursor-help rounded-full focus-visible:outline-2 focus-visible:outline-gold-400" onClick={(e) => e.stopPropagation()}>
            <Badge tone="neutral" className="px-2 py-px text-[10px]">
              <ArchiveBook variant="Bold" /> {t("admin.control.archive.badge")}
            </Badge>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

/* ───────────────────────────── actions ───────────────────────────── */

export type ArchiveEntity = "projects" | "organizations" | "documents" | "complaints";

/**
 * Block / unblock (organisations, users — reason required when blocking) and archive / unarchive
 * (projects, organisations, documents, complaints) through the shared confirm dialog.
 */
export function useControlActions(confirm: (o: ConfirmOptions) => void) {
  const { t } = useI18n();

  const block = React.useCallback(
    (kind: "org" | "user", row: { id: string } & ControlFlags & { status?: string }, name: string, onDone: (patch: ControlFlags & { status?: "ACTIVE" | "BLOCKED" }) => void) => {
      const blocking = kind === "org" ? !row.blockedAt : row.status !== "BLOCKED";
      const path = kind === "org" ? `/admin/organizations/${row.id}/block` : `/admin/users/${row.id}/block`;
      confirm({
        title: blocking ? t(kind === "org" ? "admin.control.block.orgTitle" : "admin.control.block.userTitle") : t("admin.control.block.unblockTitle"),
        description: blocking
          ? t(kind === "org" ? "admin.control.block.orgDesc" : "admin.control.block.userDesc", { name })
          : t(kind === "org" ? "admin.control.block.unblockOrgDesc" : "admin.control.block.unblockUserDesc", { name }),
        tone: blocking ? "danger" : "success",
        icon: blocking ? Lock1 : Unlock,
        confirmLabel: blocking ? t("admin.control.block.block") : t("admin.control.block.unblock"),
        reason: blocking ? { label: t("admin.control.block.reason"), placeholder: t("admin.control.block.reasonPlaceholder"), required: true } : undefined,
        onConfirm: async (reason) => {
          if (blocking && reason.trim().length < 3) throw new Error(t("admin.control.block.reasonShort"));
          await api.post(path, blocking ? { blocked: true, reason } : { blocked: false });
          const now = new Date().toISOString();
          onDone(
            kind === "org"
              ? { blockedAt: blocking ? now : null, blockReason: blocking ? reason : null }
              : { status: blocking ? "BLOCKED" : "ACTIVE", blockReason: blocking ? reason : null },
          );
          toast.success(blocking ? t("admin.control.block.blocked") : t("admin.control.block.unblocked"), { description: name });
        },
      });
    },
    [confirm, t],
  );

  const archive = React.useCallback(
    (entity: ArchiveEntity, row: { id: string } & ControlFlags, name: string, onDone: (patch: ControlFlags) => void) => {
      const archiving = !row.archivedAt;
      confirm({
        title: archiving ? t("admin.control.archive.archiveTitle") : t("admin.control.archive.unarchiveTitle"),
        description: archiving ? t("admin.control.archive.archiveDesc", { name }) : t("admin.control.archive.unarchiveDesc", { name }),
        tone: archiving ? "gold" : "success",
        icon: archiving ? Archive : ArchiveBook,
        confirmLabel: archiving ? t("admin.control.archive.archive") : t("admin.control.archive.unarchive"),
        reason: archiving ? { label: t("admin.control.archive.note"), placeholder: t("admin.control.archive.notePlaceholder") } : undefined,
        onConfirm: async (reason) => {
          await api.post(`/admin/${entity}/${row.id}/archive`, { archived: archiving, ...(reason ? { reason } : {}) });
          onDone({ archivedAt: archiving ? new Date().toISOString() : null });
          toast.success(archiving ? t("admin.control.archive.archived") : t("admin.control.archive.unarchived"), { description: name });
        },
      });
    },
    [confirm, t],
  );

  /** Ready-made row actions for RowActions. */
  const rowActions = React.useCallback(
    (opts: {
      archive?: { entity: ArchiveEntity; row: { id: string } & ControlFlags; name: string; onDone: (p: ControlFlags) => void };
      block?: { kind: "org" | "user"; row: { id: string } & ControlFlags & { status?: string }; name: string; onDone: (p: ControlFlags & { status?: "ACTIVE" | "BLOCKED" }) => void; hidden?: boolean };
    }): RowAction[] => {
      const out: RowAction[] = [];
      if (opts.block && !opts.block.hidden) {
        const b = opts.block;
        const isBlocked = b.kind === "org" ? Boolean(b.row.blockedAt) : b.row.status === "BLOCKED";
        out.push({
          label: isBlocked ? t("admin.control.block.unblock") : t("admin.control.block.block"),
          icon: isBlocked ? Unlock : Lock1,
          tone: isBlocked ? "success" : "danger",
          separatorBefore: true,
          onSelect: () => block(b.kind, b.row, b.name, b.onDone),
        });
      }
      if (opts.archive) {
        const a = opts.archive;
        out.push({
          label: a.row.archivedAt ? t("admin.control.archive.unarchive") : t("admin.control.archive.archive"),
          icon: a.row.archivedAt ? ArchiveBook : Archive,
          tone: "gold",
          separatorBefore: !opts.block || Boolean(opts.block.hidden),
          onSelect: () => archive(a.entity, a.row, a.name, a.onDone),
        });
      }
      return out;
    },
    [archive, block, t],
  );

  return { block, archive, rowActions };
}
