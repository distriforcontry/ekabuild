"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLES, type Role } from "@eka/shared";
import { Activity, ProfileTick, UserEdit, Verify } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { ControlFlags, User } from "@/lib/types";
import { ExcelButton } from "@/components/control/ExportButton";
import { Segmented } from "@/components/control/ui";
import { ControlBadges, useControlActions } from "./control";
import { useAdmin } from "./context";
import { useFormat } from "./format";
import { useApiList, useListState } from "./hooks";
import { Avatar, Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox, useConfirm } from "./primitives";

const FILTERS = ["role", "status"] as const;
const ROLE_TONE: Record<Role, "neutral" | "gold" | "info" | "success" | "danger"> = {
  BUYER: "neutral",
  DEVELOPER: "info",
  INSPECTOR: "success",
  ADMIN: "gold",
  SUPERADMIN: "gold",
};

type UserRow = User & ControlFlags & { lastLoginAt?: string | null };

export function UsersView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { user: me } = useAdmin();
  const list = useListState(FILTERS, { sort: { key: "createdAt", dir: "desc" } });
  const data = useApiList<UserRow>("/admin/users", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();
  const control = useControlActions(confirm);
  const router = useRouter();
  const [roleFor, setRoleFor] = React.useState<User | null>(null);

  const patch = async (u: User, body: Partial<Pick<User, "role" | "status">>) => {
    await api.patch(`/admin/users/${u.id}`, body);
    data.mutate((items) => items.map((x) => (x.id === u.id ? { ...x, ...body } : x)));
  };

  const isSuper = me.role === "SUPERADMIN";
  const canEdit = (u: User) => u.id !== me.id && (isSuper || (u.role !== "SUPERADMIN" && u.role !== "ADMIN"));

  const columns: Column<UserRow>[] = [
    {
      key: "fullName",
      header: t("admin.users.columns.user"),
      alwaysVisible: true,
      sortable: true,
      exportValue: (u) => u.fullName,
      cell: (u) => (
        <div className="flex min-w-52 items-center gap-3">
          <Avatar name={u.fullName} src={u.avatarUrl} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-semibold text-stone-100">
              <Link href={`/admin/users/${u.id}`} onClick={(e) => e.stopPropagation()} className="truncate transition hover:text-gold-300">
                {u.fullName}
              </Link>
              {u.id === me.id && <Badge tone="gold" className="px-1.5 py-0 text-[9px]">{t("admin.support.you")}</Badge>}
            </div>
            <div className="truncate text-xs text-ink-400">{u.email ?? u.pinfl ?? "—"}</div>
            <ControlBadges row={u} className="mt-1 flex flex-wrap items-center gap-1 empty:hidden" />
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: t("admin.users.columns.phone"),
      exportValue: (u) => u.phone,
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-ink-200">
          {u.phone}
          {u.phoneVerifiedAt && <Verify size={13} variant="Bold" className="text-success" aria-label={t("admin.users.verifiedPhone")} />}
        </span>
      ),
    },
    {
      key: "role",
      header: t("admin.users.columns.role"),
      sortable: true,
      exportValue: (u) => label("role", u.role),
      cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{label("role", u.role)}</Badge>,
    },
    {
      key: "organization",
      header: t("admin.users.columns.organization"),
      hideOnMobile: true,
      exportValue: (u) => u.organization?.name,
      cell: (u) =>
        u.organization ? (
          <div className="max-w-44">
            <div className="truncate text-sm text-ink-100">{tr(u.organization.name)}</div>
            <div className="font-mono text-[11px] text-ink-400">{u.organization.tin}</div>
          </div>
        ) : (
          <span className="text-xs text-ink-500">{t("admin.users.individual")}</span>
        ),
    },
    {
      key: "status",
      header: t("admin.users.columns.status"),
      sortable: true,
      exportValue: (u) => t(`admin.users.status.${u.status}`),
      cell: (u) => (
        <Badge tone={u.status === "BLOCKED" ? "danger" : "success"} dot>
          {t(`admin.users.status.${u.status}`)}
        </Badge>
      ),
    },
    {
      key: "lastLoginAt",
      header: t("admin.control.activity.profile.lastLogin"),
      sortable: true,
      hideOnMobile: true,
      exportValue: (u) => u.lastLoginAt ?? "",
      cell: (u) => <span className="whitespace-nowrap text-xs text-ink-300" title={u.lastLoginAt ? f.dateTime(u.lastLoginAt) : undefined}>{u.lastLoginAt ? f.relative(u.lastLoginAt) : "—"}</span>,
    },
    {
      key: "createdAt",
      header: t("admin.users.columns.created"),
      sortable: true,
      hideOnMobile: true,
      exportValue: (u) => u.createdAt,
      cell: (u) => <span className="whitespace-nowrap text-xs text-ink-400">{f.date(u.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (u) =>
        canEdit(u) ? (
          <RowActions
            actions={[
              { label: t("admin.control.activity.open"), icon: Activity, onSelect: () => router.push(`/admin/users/${u.id}`) },
              { label: t("admin.users.changeRole"), icon: UserEdit, onSelect: () => setRoleFor(u) },
              ...control.rowActions({
                block: {
                  kind: "user",
                  row: u,
                  name: u.fullName,
                  onDone: (p) => {
                    data.mutate((items) => items.map((x) => (x.id === u.id ? { ...x, ...p } : x)));
                    if (list.filters.status) data.reload();
                  },
                },
              }),
            ]}
          />
        ) : (
          <span className="inline-flex items-center">
            <Link href={`/admin/users/${u.id}`} onClick={(e) => e.stopPropagation()} aria-label={t("admin.control.activity.open")} className="grid size-8 place-items-center rounded-lg text-ink-400 transition hover:bg-fg/6 hover:text-gold-300">
              <Activity size={16} />
            </Link>
            <span className="inline-grid size-8 place-items-center text-ink-500" title={t("admin.users.self")}>
              <ProfileTick size={16} />
            </span>
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.system")} title={t("admin.users.title")} description={t("admin.users.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          size="md"
          label={t("admin.control.archive.tabsLabel")}
          value={(list.filters.status ?? "ALL") as "ALL" | "ACTIVE" | "BLOCKED"}
          onChange={(v) => list.update({ status: v === "ALL" ? null : v })}
          options={[
            { value: "ALL", label: t("admin.control.archive.tabs.all") },
            { value: "ACTIVE", label: t("admin.users.status.ACTIVE") },
            { value: "BLOCKED", label: t("admin.control.archive.tabs.blocked") },
          ]}
        />
      </div>
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(u) => u.id}
          onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          exportName="users"
          emptyTitle={t("admin.users.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.role}
                onChange={(v) => list.update({ role: v })}
                placeholder={t("admin.users.filters.role")}
                options={ROLES.map((v) => ({ value: v, label: label("role", v) }))}
              />
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
              <ExcelButton area="admin" entity="users" filters={{ q: list.q, status: list.filters.status }} className="sm:ml-auto" />
            </>
          }
        />
      </Dim>

      <RoleDialog
        user={roleFor}
        allowAdmin={isSuper}
        onClose={() => setRoleFor(null)}
        onSave={async (u, role) => {
          await patch(u, { role });
          toast.success(t("admin.users.roleChanged"));
        }}
      />
      {confirmNode}
    </div>
  );
}

function RoleDialog({
  user,
  allowAdmin,
  onClose,
  onSave,
}: {
  user: User | null;
  allowAdmin: boolean;
  onClose: () => void;
  onSave: (u: User, role: Role) => Promise<void>;
}) {
  const { t, label } = useI18n();
  const [role, setRole] = React.useState<Role | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setRole(user?.role ?? null), [user]);

  const options = ROLES.map((r) => ({
    value: r,
    label: label("role", r),
    disabled: !allowAdmin && (r === "ADMIN" || r === "SUPERADMIN"),
    description: !allowAdmin && (r === "ADMIN" || r === "SUPERADMIN") ? t("admin.users.superOnly") : undefined,
  }));

  const save = async () => {
    if (!user || !role || role === user.role) return onClose();
    setBusy(true);
    try {
      await onSave(user, role);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="sm">
        <DialogHeader className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
            <UserEdit size={22} variant="Bulk" />
          </span>
          <div>
            <DialogTitle>{t("admin.users.changeRole")}</DialogTitle>
            <DialogDescription>{user ? t("admin.users.changeRoleDesc", { name: user.fullName }) : ""}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          <Field label={t("admin.users.newRole")}>
            <Combobox options={options} value={role} onChange={(v) => setRole(v as Role | null)} clearable={false} searchable={false} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.actions.cancel")}
          </Button>
          <Button variant="gold" onClick={save} loading={busy} disabled={!role || role === user?.role}>
            {t("common.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
