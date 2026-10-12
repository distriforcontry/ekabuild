"use client";
import * as React from "react";
import Link from "next/link";
import { MotionConfig } from "motion/react";
import {
  Activity,
  Add,
  Bag2,
  Buildings,
  Buildings2,
  Chart,
  ClipboardText,
  ClipboardTick,
  DocumentText,
  Folder2,
  Heart,
  Home2,
  I3DRotate,
  Map1,
  MessageQuestion,
  Notification,
  ReceiptText,
  ScanBarcode,
  SecurityUser,
  Setting2,
  ShieldTick,
  TaskSquare,
  Verify,
} from "iconsax-reactjs";
import { CommandPalette, type PaletteGroup, type PaletteItem } from "@/components/layout/CommandPalette";
import { DashboardShell, type NavItem, type NavSection } from "@/components/layout/DashboardShell";
import { formatMasked } from "@/components/ui/masked-input";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { homeForRole, isAdmin } from "@/lib/roles";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CabinetProviders, useCabinetUser, useNotifications } from "./CabinetContext";
import { asList } from "./hooks";
import { NotificationsBell } from "./NotificationsBell";

/** Client wrapper around DashboardShell: role-tailored navigation, ⌘K palette, notification badge and bell. */
export function CabinetShell({ user, defaultCollapsed, children }: { user: User; defaultCollapsed?: boolean; children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CabinetProviders user={user}>
        <ShellInner defaultCollapsed={defaultCollapsed}>{children}</ShellInner>
      </CabinetProviders>
    </MotionConfig>
  );
}

/** Developers / inspectors who also bought something get the buyer section too. */
function useAlsoBuys(enabled: boolean) {
  const [buys, setBuys] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .get<unknown>("/purchases")
      .then((r) => alive && setBuys(asList(r).length > 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return buys;
}

function ShellInner({ defaultCollapsed, children }: { defaultCollapsed?: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const { user } = useCabinetUser();
  const { unread } = useNotifications();
  const admin = isAdmin(user.role);
  const role = user.role;
  const alsoBuys = useAlsoBuys(role === "DEVELOPER" || role === "INSPECTOR");
  const home = admin ? "/app" : homeForRole(role);

  const nav = React.useMemo<NavSection[]>(() => {
    const n = (key: Parameters<typeof t>[0]) => t(key);
    const notifBadge = unread > 99 ? "99+" : unread || null;

    const buyerItems = (withHome: boolean): NavItem[] => [
      ...(withHome ? [{ href: "/app", label: n("app.shell.nav.dashboard"), icon: Home2, exact: true, mobile: true }] : []),
      { href: "/app/purchases", label: n("app.shell.nav.purchases"), icon: Bag2, mobile: withHome },
      ...(withHome ? [{ href: "/app/contracts", label: n("app.shell.nav.contracts"), icon: DocumentText, mobile: true }] : []),
      { href: "/app/files", label: n("app.shell.nav.files"), icon: Folder2 },
      { href: "/app/feed", label: n("app.shell.nav.feed"), icon: Activity, mobile: withHome },
      { href: "/app/favorites", label: n("app.shell.nav.favorites"), icon: Heart },
    ];
    const account = (support: boolean): NavSection => ({
      title: n("app.shell.sections.account"),
      items: [
        { href: "/app/notifications", label: n("app.shell.nav.notifications"), icon: Notification, badge: notifBadge },
        ...(support ? [{ href: "/app/support", label: n("app.shell.nav.support"), icon: MessageQuestion }] : []),
        { href: "/app/settings", label: n("app.shell.nav.settings"), icon: Setting2 },
      ],
    });
    const platform = (studio: "editor" | "viewer" | null): NavSection => ({
      title: n("app.shell.sections.platform"),
      items: [
        ...(admin ? [{ href: "/admin", label: n("app.shell.nav.admin"), icon: SecurityUser }] : []),
        { href: "/projects", label: n("app.shell.nav.catalog"), icon: Buildings },
        ...(studio === "viewer" ? [{ href: "/app/studio", label: n("app.shell.nav.studio"), icon: I3DRotate }] : []),
      ],
    });
    const inspector: NavSection = {
      title: n("app.shell.sections.inspector"),
      items: [
        { href: "/app/inspector", label: n("app.shell.nav.inspPanel"), icon: ShieldTick, exact: true, mobile: true },
        { href: "/app/inspector/queue", label: n("app.shell.nav.inspQueue"), icon: TaskSquare, mobile: true },
        { href: "/app/inspector/inspections/new", label: n("app.shell.nav.inspNew"), icon: ClipboardTick, mobile: true },
        { href: "/app/inspector/cadastre", label: n("app.shell.nav.cadastre"), icon: Map1, mobile: true },
      ],
    };

    if (role === "DEVELOPER") {
      return [
        {
          title: n("app.shell.sections.developer"),
          items: [
            { href: "/app/developer", label: n("app.shell.nav.devPanel"), icon: Chart, exact: true, mobile: true },
            { href: "/app/developer/projects", label: n("app.shell.nav.devProjects"), icon: Buildings2, mobile: true },
            { href: "/app/developer/sales", label: n("app.shell.nav.devSales"), icon: ReceiptText, mobile: true },
            { href: "/app/contracts", label: n("app.shell.nav.contracts"), icon: DocumentText, mobile: true },
            { href: "/app/studio", label: n("app.shell.nav.studio"), icon: I3DRotate },
          ],
        },
        ...(alsoBuys ? [{ title: n("app.shell.sections.buyer"), items: buyerItems(false) }] : []),
        account(true),
        platform(null),
      ];
    }
    if (role === "INSPECTOR") {
      return [
        inspector,
        ...(alsoBuys ? [{ title: n("app.shell.sections.buyer"), items: buyerItems(false) }] : []),
        account(false),
        platform("viewer"),
      ];
    }
    // buyers (individual & legal entity) and admins visiting the cabinet
    return [
      { title: n("app.shell.sections.main"), items: buyerItems(true) },
      ...(admin ? [{ ...inspector, items: inspector.items.map((i) => ({ ...i, mobile: false })) }] : []),
      account(true),
      platform("viewer"),
    ];
  }, [t, unread, role, admin, alsoBuys]);

  const palette = React.useMemo<PaletteGroup[]>(() => {
    const pages: PaletteItem[] = nav.flatMap((s) =>
      s.items.map((i) => ({ id: `p-${i.href}`, label: i.label, hint: s.title, icon: i.icon, href: i.href })),
    );
    const actions: PaletteItem[] = [];
    if (role === "DEVELOPER" || admin) {
      actions.push({ id: "a-new-project", label: t("app.shell.quick.newProject"), icon: Add, href: "/app/developer/projects/new", keywords: "obyekt project объект" });
      actions.push({ id: "a-sign", label: t("app.shell.quick.pendingSales"), icon: ReceiptText, href: "/app/developer/sales" });
    }
    if (role === "INSPECTOR" || admin) {
      actions.push({ id: "a-inspection", label: t("app.shell.quick.newInspection"), icon: ClipboardText, href: "/app/inspector/inspections/new" });
      actions.push({ id: "a-cadastre", label: t("app.shell.quick.cadastre"), icon: Map1, href: "/app/inspector/cadastre" });
    }
    actions.push({ id: "a-catalog", label: t("app.shell.quick.catalog"), icon: Buildings, href: "/projects", keywords: "katalog catalog каталог" });
    actions.push({ id: "a-verify", label: t("app.shell.quick.verify"), icon: ScanBarcode, href: "/verify", keywords: "qr sertifikat certificate" });
    if (role !== "INSPECTOR") actions.push({ id: "a-support", label: t("app.shell.quick.support"), icon: MessageQuestion, href: "/app/support" });
    return [
      { id: "actions", title: t("app.layout.palette.actions"), items: actions },
      { id: "pages", title: t("app.layout.palette.pages"), items: pages },
    ];
  }, [nav, role, admin, t]);

  return (
    <DashboardShell
      area={t("app.shell.area")}
      nav={nav}
      homeHref={home}
      defaultCollapsed={defaultCollapsed}
      user={{
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        organization: user.organization ? { name: user.organization.name, tin: user.organization.tin, status: user.organization.status } : null,
      }}
      sidebarTop={user.organization ? <OrgContextCard /> : undefined}
      topbar={
        <>
          <CommandPalette groups={palette} />
          <NotificationsBell />
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}

/** "Tashkilot" context in the sidebar: which legal entity the user acts for, its STIR and verification state. */
function OrgContextCard() {
  const { t, label, tr } = useI18n();
  const { user } = useCabinetUser();
  const org = user.organization;
  if (!org) return null;
  const tone = org.status === "VERIFIED" ? "text-success" : org.status === "REJECTED" ? "text-danger" : "text-warning";
  return (
    <Link
      href="/app/settings#organization"
      className="group relative block overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-gold-500/[0.09] via-ink-850/60 to-transparent p-3.5 transition hover:border-gold-500/35"
    >
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-gold-400">
        <Buildings2 size={14} variant="Bulk" /> {t("app.shell.org.title")}
      </div>
      <div className="relative mt-2 truncate text-sm font-semibold text-stone-100">{tr(org.name)}</div>
      <div className="relative mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-mono text-ink-300">
          {t("app.shell.org.tin")} {formatMasked("tin", org.tin)}
        </span>
        <span className={cn("inline-flex items-center gap-1 font-semibold", tone)}>
          <Verify size={12} variant="Bold" /> {label("verification", org.status)}
        </span>
      </div>
    </Link>
  );
}
