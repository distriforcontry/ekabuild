"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { ExportSquare } from "iconsax-reactjs";
import { toast } from "sonner";
import { DashboardShell, type NavSection } from "@/components/layout/DashboardShell";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { useSupportSocket, type SupportEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { AdminContext, type AdminContextValue, type AdminCounts, type AdminUser } from "./context";
import { CommandPalette } from "./CommandPalette";
import { siteOrigin } from "./format";
import { ADMIN_NAV, navLabelKey } from "./nav";
import type { AdminStats, SupportStats } from "./types";

/**
 * Client wrapper around DashboardShell for /admin: navigation with live badges,
 * one shared support WebSocket for the whole admin (inbox, badges, toasts), ⌘K palette.
 */
export function AdminShell({
  user,
  area,
  defaultCollapsed,
  children,
}: {
  user: AdminUser;
  area: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = React.useState<AdminCounts | null>(null);
  const [supportStats, setSupportStats] = React.useState<SupportStats | null>(null);
  const [siteHref, setSiteHref] = React.useState("/");

  React.useEffect(() => setSiteHref(siteOrigin()), []);

  // ── badges
  const loadCounts = React.useCallback(async () => {
    const [stats, support] = await Promise.allSettled([
      api.get<AdminStats>("/admin/stats"),
      api.get<SupportStats>("/admin/support/stats"),
    ]);
    if (stats.status === "fulfilled" && stats.value?.kpi) {
      const k = stats.value.kpi;
      setCounts({
        pendingOrgs: k.pendingOrgs ?? 0,
        pendingProjects: k.pendingProjects ?? 0,
        pendingCertificates: k.pendingCertificates ?? 0,
        pendingDocuments: k.pendingDocuments ?? 0,
        openComplaints: k.openComplaints ?? 0,
      });
    }
    if (support.status === "fulfilled" && support.value) setSupportStats(support.value);
  }, []);

  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshCounts = React.useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(loadCounts, 600);
  }, [loadCounts]);

  React.useEffect(() => {
    loadCounts();
    const id = setInterval(loadCounts, 90_000);
    const onFocus = () => document.visibilityState === "visible" && loadCounts();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadCounts]);

  // ── realtime (single socket, fan-out to subscribers)
  const listeners = React.useRef(new Set<(e: SupportEvent) => void>());
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;

  const onEvent = React.useCallback(
    (e: SupportEvent) => {
      listeners.current.forEach((fn) => fn(e));
      if (e.type === "presence") setSupportStats((s) => (s ? { ...s, agentsOnline: e.agentsOnline } : s));
      if (e.type === "thread") refreshCounts();
      if (e.type === "message" && e.message.senderType === "USER" && !pathRef.current.startsWith("/admin/support")) {
        const m = e.message;
        toast(m.sender?.fullName ?? t("admin.support.guest"), {
          description: m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body,
          action: { label: t("admin.support.notify.open"), onClick: () => router.push(`/admin/support?thread=${m.threadId}`) },
        });
      }
    },
    [refreshCounts, router, t],
  );

  const socket = useSupportSocket({ onEvent });
  const subscribe = React.useCallback((fn: (e: SupportEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const realtime = React.useMemo(() => ({ status: socket.status, send: socket.send, subscribe }), [socket.status, socket.send, subscribe]);

  const ctx = React.useMemo<AdminContextValue>(
    () => ({ user, counts, supportStats, refreshCounts, realtime }),
    [user, counts, supportStats, refreshCounts, realtime],
  );

  // ── navigation
  const nav: NavSection[] = ADMIN_NAV.map((section) => ({
    title: t(section.title),
    items: section.items.map((item) => {
      let badge: number | null = null;
      if (item.badge === "support") badge = supportStats?.open ?? null;
      else if (item.badge && counts) badge = counts[item.badge];
      return {
        href: item.href,
        label: t(navLabelKey(item.key)),
        icon: item.icon,
        exact: item.exact,
        badge: badge ? (badge > 99 ? "99+" : badge) : null,
      };
    }),
  }));

  const topbar = (
    <>
      <CommandPalette />
      <LivePill status={socket.status} />
      <a
        href={siteHref}
        target="_blank"
        rel="noopener"
        className="hidden h-10 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-ink-200 transition hover:border-gold-500/40 hover:bg-gold-500/5 hover:text-gold-200 lg:inline-flex"
      >
        <ExportSquare size={16} />
        <span className="hidden xl:inline">{t("admin.topbar.site")}</span>
      </a>
    </>
  );

  return (
    <AdminContext.Provider value={ctx}>
      <MotionConfig reducedMotion="user">
        <DashboardShell
          area={area}
          nav={nav}
          user={{ fullName: user.fullName, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, organization: user.organization }}
          defaultCollapsed={defaultCollapsed}
          topbar={topbar}
        >
          {children}
        </DashboardShell>
      </MotionConfig>
    </AdminContext.Provider>
  );
}

function LivePill({ status }: { status: AdminContextValue["realtime"]["status"] }) {
  const { t } = useI18n();
  const live = status === "open";
  const label = live ? t("admin.topbar.live") : status === "connecting" || status === "closed" ? t("admin.topbar.reconnecting") : t("admin.topbar.offline");
  return (
    <span
      role="status"
      title={label}
      className={cn(
        "hidden h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold tracking-wide sm:inline-flex",
        live ? "border-success/25 bg-success/[0.06] text-success" : "border-line text-ink-400",
      )}
    >
      <span className="relative flex size-2">
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-success/70" />}
        <span className={cn("relative size-2 rounded-full", live ? "bg-success" : status === "idle" ? "bg-ink-500" : "animate-pulse bg-warning")} />
      </span>
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}
