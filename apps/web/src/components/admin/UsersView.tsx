"use client";
import * as React from "react";
import { ROLES, type Role } from "@eka/shared";
import { Lock1, ProfileTick, Unlock, UserEdit, Verify } from "iconsax-reactjs";
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
import type { User } from "@/lib/types";
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

export function UsersView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { user: me } = useAdmin();
  const list = useListState(FILTERS, { sort: { key: "createdAt", dir: "desc" } });
  const data = useApiList<User>("/admin/users", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();
  const [roleFor, setRoleFor] = React.useState<User | null>(null);

  const patch = async (u: User, body: Partial<Pick<User, "role" | "status">>) => {
    await api.patch(`/admin/users/${u.id}`, body);
    data.mutate((items) => items.map((x) => (x.id === u.id ? { ...x, ...body } : x)));
  };

  const toggleBlock = (u: User) => {
    const blocking = u.status !== "BLOCKED";
    confirm({
      title: blocking ? t("admin.users.blockTitle") : t("admin.users.unblockTitle"),
      description: blocking ? t("admin.users.blockDesc", { name: u.fullName }) : t("admin.users.unblockDesc", { name: u.fullName }),
      tone: blocking ? "danger" : "success",
      icon: blocking ? Lock1 : Unlock,
      confirmLabel: blocking ? t("admin.users.block") : t("admin.users.unblock"),
      onConfirm: async () => {
        await patch(u, { status: blocking ? "BLOCKED" : "ACTIVE" });
        toast.success(blocking ? t("admin.users.blocked") : t("admin.users.unblocked"));
      },
    });
  };

  const isSuper = me.role === "SUPERADMIN";
  const canEdit = (u: User) => u.id !== me.id && (isSuper || (u.role !== "SUPERADMIN" && u.role !== "ADMIN"));

  const columns: Column<User>[] = [
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
              {u.fullName}
              {u.id === me.id && <Badge tone="gold" className="px-1.5 py-0 text-[9px]">{t("admin.support.you")}</Badge>}
            </div>
            <div className="truncate text-xs text-ink-400">{u.email ?? u.pinfl ?? "—"}</div>
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
              { label: t("admin.users.changeRole"), icon: UserEdit, onSelect: () => setRoleFor(u) },
              u.status === "BLOCKED"
                ? { label: t("admin.users.unblock"), icon: Unlock, tone: "success", onSelect: () => toggleBlock(u), separatorBefore: true }
                : { label: t("admin.users.block"), icon: Lock1, tone: "danger", onSelect: () => toggleBlock(u), separatorBefore: true },
            ]}
          />
        ) : (
          <span className="inline-grid size-8 place-items-center text-ink-500" title={t("admin.users.self")}>
            <ProfileTick size={16} />
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.system")} title={t("admin.users.title")} description={t("admin.users.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(u) => u.id}
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
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.users.filters.status")}
                options={(["ACTIVE", "BLOCKED"] as const).map((v) => ({ value: v, label: t(`admin.users.status.${v}`) }))}
              />
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
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
