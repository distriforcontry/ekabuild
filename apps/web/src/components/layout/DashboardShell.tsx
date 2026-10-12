"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowDown2, HamburgerMenu, Home2, LogoutCurve, Setting2, SidebarLeft, SidebarRight } from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import type { Role } from "@eka/shared";

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  badge?: string | number | null;
  /** match only the exact path (for index routes like /admin) */
  exact?: boolean;
};
export type NavSection = { title?: string; items: NavItem[] };

export type ShellUser = { fullName: string; phone?: string | null; role: Role; avatarUrl?: string | null; organization?: { name: string } | null };

const SIDEBAR_COOKIE = "eka_sidebar";
const W_OPEN = 272;
const W_COLLAPSED = 80;

/**
 * Dashboard layout used by the cabinet (/app) and admin (/admin):
 * collapsible sidebar (animated, persisted in a cookie, tooltips when collapsed),
 * mobile drawer, sticky top bar with language/theme switches and user menu.
 */
export function DashboardShell({
  area,
  nav,
  user,
  defaultCollapsed = false,
  topbar,
  settingsHref = "/app/settings",
  children,
}: {
  /** where the user menu's "Settings" item points */
  settingsHref?: string;
  /** small label under the logo, e.g. "Admin" */
  area: string;
  nav: NavSection[];
  user: ShellUser;
  defaultCollapsed?: boolean;
  /** extra controls in the top bar (notifications, quick actions…) */
  topbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? 0 : 1}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  // ⌘B / Ctrl+B toggles the sidebar
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-ink-950">
      {/* desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? W_COLLAPSED : W_OPEN }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-ink-900/80 backdrop-blur-xl lg:flex"
      >
        <SidebarInner area={area} nav={nav} collapsed={collapsed} onToggle={toggle} />
      </motion.aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-onyx/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col border-r border-line bg-ink-900 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <SidebarInner area={area} nav={nav} collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* content */}
      <div className={cn("min-h-dvh transition-[padding] duration-500 ease-[cubic-bezier(.16,1,.3,1)]", collapsed ? "lg:pl-20" : "lg:pl-[272px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink-950/75 px-4 backdrop-blur-xl md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 lg:hidden"
            aria-label={t("common.sidebar.menu")}
          >
            <HamburgerMenu size={20} />
          </button>
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <LogoMark className="h-7" />
          </Link>
          <div className="flex-1" />
          {topbar}
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu user={user} settingsHref={settingsHref} />
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 md:px-8 md:py-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function SidebarInner({ area, nav, collapsed, onToggle }: { area: string; nav: NavSection[]; collapsed: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <>
      <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center px-0" : "justify-between px-5")}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <LogoMark className="h-9 shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="leading-none whitespace-nowrap">
                <div className="text-[15px] font-extrabold tracking-[0.16em] text-stone-100">
                  EKA<span className="text-gold-400"> BUILD</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">{area}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {nav.map((section, si) => (
          <div key={si} className="mb-5">
            {section.title &&
              (collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-line-strong" />
              ) : (
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">{section.title}</div>
              ))}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "text-stone-100" : "text-ink-300 hover:bg-fg/[0.04] hover:text-stone-100",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl border border-gold-500/25 bg-gradient-to-r from-gold-500/15 to-gold-500/[0.03]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    {active && <motion.span layoutId="sidebar-bar" className="absolute -left-3 top-2.5 h-6 w-1 rounded-r-full bg-gold-400" />}
                    <Icon size={20} variant={active ? "Bulk" : "Linear"} className={cn("relative shrink-0 transition", active ? "text-gold-300" : "group-hover:text-gold-300")} />
                    {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                    {item.badge != null && item.badge !== 0 && (
                      <span
                        className={cn(
                          "relative grid min-w-5 place-items-center rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-onyx",
                          collapsed && "absolute right-2 top-1.5 h-4 min-w-4 px-1",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip content={item.label} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {onToggle && (
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl text-sm text-ink-400 transition hover:bg-fg/[0.04] hover:text-stone-100",
              collapsed ? "justify-center" : "px-3",
            )}
            aria-label={collapsed ? t("common.sidebar.expand") : t("common.sidebar.collapse")}
          >
            {collapsed ? <SidebarRight size={20} /> : <SidebarLeft size={20} />}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{t("common.sidebar.collapse")}</span>
                <kbd className="rounded border border-line px-1.5 font-mono text-[10px]">⌘B</kbd>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

function UserMenu({ user, settingsHref }: { user: ShellUser; settingsHref: string }) {
  const router = useRouter();
  const { t, label } = useI18n();
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line py-1 pl-1 pr-2.5 transition hover:border-line-strong hover:bg-fg/5">
          <span className="grid size-8 place-items-center overflow-hidden rounded-lg bg-gold-gradient text-xs font-bold text-onyx">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : initials(user.fullName)}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-36 truncate text-xs font-semibold text-stone-100">{user.fullName}</span>
            <span className="block text-[10px] text-ink-400">{label("role", user.role)}</span>
          </span>
          <ArrowDown2 size={14} className="hidden text-ink-400 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel>
          <div className="font-semibold text-stone-100">{user.fullName}</div>
          <div className="mt-0.5 font-mono">{user.phone}</div>
          {user.organization && <div className="mt-0.5 truncate">{user.organization.name}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/")}>
          <Home2 /> {t("common.nav.home")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(settingsHref)}>
          <Setting2 /> {t("common.nav.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-danger data-[highlighted]:text-danger">
          <LogoutCurve className="!text-danger" /> {t("common.nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
