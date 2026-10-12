"use client";
import * as React from "react";
import { MotionConfig } from "motion/react";
import {
  Activity,
  Bag2,
  Buildings,
  Buildings2,
  Chart,
  ClipboardTick,
  DocumentText,
  Folder2,
  Heart,
  Home2,
  Map1,
  MessageQuestion,
  Notification,
  ReceiptText,
  SecurityUser,
  Setting2,
  ShieldTick,
} from "iconsax-reactjs";
import { DashboardShell, type NavSection } from "@/components/layout/DashboardShell";
import { useI18n } from "@/i18n/client";
import { isAdmin } from "@/lib/roles";
import type { User } from "@/lib/types";
import { CabinetProviders, useCabinetUser, useNotifications } from "./CabinetContext";
import { NotificationsBell } from "./NotificationsBell";

/** Client wrapper around DashboardShell: role-based navigation, notification badge and bell. */
export function CabinetShell({ user, defaultCollapsed, children }: { user: User; defaultCollapsed?: boolean; children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CabinetProviders user={user}>
        <ShellInner defaultCollapsed={defaultCollapsed}>{children}</ShellInner>
      </CabinetProviders>
    </MotionConfig>
  );
}

function ShellInner({ defaultCollapsed, children }: { defaultCollapsed?: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const { user } = useCabinetUser();
  const { unread } = useNotifications();
  const admin = isAdmin(user.role);

  const nav = React.useMemo<NavSection[]>(() => {
    const main: NavSection = {
      title: t("app.shell.sections.main"),
      items: [
        { href: "/app", label: t("app.shell.nav.dashboard"), icon: Home2, exact: true },
        { href: "/app/purchases", label: t("app.shell.nav.purchases"), icon: Bag2 },
        { href: "/app/contracts", label: t("app.shell.nav.contracts"), icon: DocumentText },
        { href: "/app/files", label: t("app.shell.nav.files"), icon: Folder2 },
        { href: "/app/feed", label: t("app.shell.nav.feed"), icon: Activity },
        { href: "/app/favorites", label: t("app.shell.nav.favorites"), icon: Heart },
        { href: "/app/notifications", label: t("app.shell.nav.notifications"), icon: Notification, badge: unread > 99 ? "99+" : unread || null },
        { href: "/app/support", label: t("app.shell.nav.support"), icon: MessageQuestion },
        { href: "/app/settings", label: t("app.shell.nav.settings"), icon: Setting2 },
      ],
    };
    const developer: NavSection = {
      title: t("app.shell.sections.developer"),
      items: [
        { href: "/app/developer", label: t("app.shell.nav.devPanel"), icon: Chart, exact: true },
        { href: "/app/developer/projects", label: t("app.shell.nav.devProjects"), icon: Buildings2 },
        { href: "/app/developer/sales", label: t("app.shell.nav.devSales"), icon: ReceiptText },
      ],
    };
    const inspector: NavSection = {
      title: t("app.shell.sections.inspector"),
      items: [
        { href: "/app/inspector", label: t("app.shell.nav.inspPanel"), icon: ShieldTick, exact: true },
        { href: "/app/inspector/inspections/new", label: t("app.shell.nav.inspections"), icon: ClipboardTick },
        { href: "/app/inspector/cadastre", label: t("app.shell.nav.cadastre"), icon: Map1 },
      ],
    };
    const platform: NavSection = {
      title: t("app.shell.sections.platform"),
      items: [
        { href: "/projects", label: t("app.shell.nav.catalog"), icon: Buildings },
        ...(admin ? [{ href: "/admin", label: t("app.shell.nav.admin"), icon: SecurityUser }] : []),
      ],
    };
    const sections: NavSection[] = [];
    if (user.role === "DEVELOPER") sections.push(developer);
    if (user.role === "INSPECTOR") sections.push(inspector);
    sections.push(main);
    if (admin) sections.push(inspector);
    sections.push(platform);
    return sections;
  }, [t, unread, user.role, admin]);

  return (
    <DashboardShell
      area={t("app.shell.area")}
      nav={nav}
      defaultCollapsed={defaultCollapsed}
      user={{ fullName: user.fullName, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, organization: user.organization }}
      topbar={<NotificationsBell />}
    >
      {children}
    </DashboardShell>
  );
}
