"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowLeft2, ArrowRight2, CloseCircle, Global, HamburgerMenu, LogoutCurve, More, Setting2, Verify } from "iconsax-reactjs";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
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
import { BreadcrumbProvider, Breadcrumbs, useCrumbs } from "./Breadcrumbs";
import { MobileTabBar } from "./MobileTabBar";
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
  /** pin to the phone bottom tab bar (max 4; defaults to the first 4 items) */
  mobile?: boolean;
};
export type NavSection = { title?: string; items: NavItem[] };

export type ShellUser = {
  fullName: string;
  phone?: string | null;
  role: Role;
  avatarUrl?: string | null;
  organization?: { name: string; tin?: string | null; status?: string | null } | null;
};

const SIDEBAR_COOKIE = "eka_sidebar";
const W_OPEN = 272;
const W_COLLAPSED = 80;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Dashboard layout used by the cabinet (/app) and admin (/admin):
 * - collapsible sidebar (animated width, cookie-persisted, ⌘B, tooltips when collapsed, user/org card in the footer);
 * - sticky top bar with breadcrumbs (pages add their own title via `useBreadcrumb`), custom controls, language/theme, user menu;
 * - phones: bottom tab bar (4 items + Menu → drawer), safe-area aware;
 * - content: soft blueprint grid + gold glow backdrop, consistent width, enter transition per route.
 */
export function DashboardShell(props: ShellProps) {
  return (
    <BreadcrumbProvider>
      <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={300}>
        <ShellLayout {...props} />
      </TooltipPrimitive.Provider>
    </BreadcrumbProvider>
  );
}

type ShellProps = {
  /** where the user menu's "Settings" item points */
  settingsHref?: string;
  /** small label under the logo, e.g. "Admin" */
  area: string;
  nav: NavSection[];
  user: ShellUser;
  defaultCollapsed?: boolean;
  /** extra controls in the top bar (command palette, notifications, quick actions…) */
  topbar?: React.ReactNode;
  /** root of the breadcrumbs / logo link (defaults to the first nav item) */
  homeHref?: string;
  /** phone tab bar items; `false` disables the bar (a hamburger is shown instead) */
  mobileTabs?: NavItem[] | false;
  /** context card at the top of the expanded sidebar and the drawer (e.g. organization) */
  sidebarTop?: React.ReactNode;
  children: React.ReactNode;
};

function ShellLayout({ area, nav, user, defaultCollapsed = false, topbar, settingsHref = "/app/settings", homeHref, mobileTabs, sidebarTop, children }: ShellProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  const allItems = React.useMemo(() => nav.flatMap((s) => s.items), [nav]);
  const home = homeHref ?? allItems[0]?.href ?? "/";
  const crumbs = useCrumbs(allItems, { href: home, label: area });
  const tabs = React.useMemo(() => {
    if (mobileTabs === false) return [];
    if (mobileTabs) return mobileTabs.slice(0, 4);
    const pinned = allItems.filter((i) => i.mobile);
    return (pinned.length ? pinned : allItems).slice(0, 4);
  }, [mobileTabs, allItems]);
  const hasTabs = tabs.length > 0;

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? 0 : 1}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  // ⌘B / Ctrl+B toggles the sidebar
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const current = crumbs[crumbs.length - 1];

  return (
    <div
      className={cn(
        "min-h-dvh bg-ink-950",
        hasTabs ? "[--shell-bottom:calc(4rem+env(safe-area-inset-bottom))] lg:[--shell-bottom:0px]" : "[--shell-bottom:0px]",
      )}
    >
      {/* desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? W_COLLAPSED : W_OPEN }}
        transition={{ duration: 0.45, ease: EASE }}
        className="group/sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-ink-900/85 backdrop-blur-xl lg:flex"
      >
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-gold-400/0 via-gold-400/20 to-gold-400/0" />
        <SidebarInner area={area} nav={nav} home={home} collapsed={collapsed} sidebarTop={sidebarTop} user={user} settingsHref={settingsHref} />
        <CollapseToggle collapsed={collapsed} onToggle={toggle} />
      </motion.aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-onyx/55 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t("common.sidebar.menu")}
              className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-line bg-ink-900 pb-[env(safe-area-inset-bottom)] shadow-lift lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3.5 z-10 grid size-9 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-fg/5 hover:text-stone-100"
                aria-label={t("common.actions.close")}
              >
                <CloseCircle size={20} />
              </button>
              <SidebarInner area={area} nav={nav} home={home} collapsed={false} sidebarTop={sidebarTop} user={user} settingsHref={settingsHref} drawer />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* content */}
      <div className={cn("relative isolate min-h-dvh transition-[padding] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)]", collapsed ? "lg:pl-20" : "lg:pl-[272px]")}>
        <Backdrop />
        <header className="sticky top-0 z-30 border-b border-line bg-ink-950/70 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-4 md:gap-3 md:px-6 lg:px-8">
            {!hasTabs && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 lg:hidden"
                aria-label={t("common.sidebar.menu")}
              >
                <HamburgerMenu size={20} className="text-gold-400" />
              </button>
            )}
            <Link href={home} className="shrink-0 lg:hidden" aria-label={area}>
              <LogoMark className="h-8" />
            </Link>
            <div className="min-w-0 flex-1 lg:hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current?.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="truncate pl-1 text-[15px] font-semibold tracking-tight text-stone-100"
                >
                  {current?.label}
                </motion.div>
              </AnimatePresence>
            </div>
            <Breadcrumbs crumbs={crumbs} className="hidden flex-1 lg:block" />
            <div className="flex shrink-0 items-center gap-2">
              {topbar}
              <LanguageSwitcher className="hidden sm:inline-flex" />
              <ThemeToggle className="hidden sm:grid" />
              <UserMenu user={user} settingsHref={settingsHref} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(var(--shell-bottom)+2rem)] pt-6 md:px-8 md:pt-8 lg:px-10 lg:pb-14">
          <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            {children}
          </motion.div>
        </main>
      </div>

      {hasTabs && <MobileTabBar items={tabs} allItems={allItems} onMenu={() => setMobileOpen((o) => !o)} menuOpen={mobileOpen} />}
    </div>
  );
}

/** Very soft architectural backdrop: blueprint grid fading out + a warm gold glow at the top. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden">
      <div className="bg-blueprint absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_75%_at_50%_0%,black_10%,transparent_70%)] light:opacity-70" />
      <div className="absolute left-1/2 top-[-280px] h-[520px] w-[min(1100px,140vw)] -translate-x-1/2 rounded-[50%] bg-gold-500/[0.09] blur-[110px] light:bg-gold-500/[0.12]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/25 to-transparent" />
    </div>
  );
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const label = collapsed ? t("common.sidebar.expand") : t("common.sidebar.collapse");
  return (
    <NavTooltip content={<span className="inline-flex items-center gap-2">{label} <kbd className="rounded border border-line px-1 font-mono text-[10px] text-ink-300">⌘B</kbd></span>}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={!collapsed}
        className="absolute -right-3 top-[76px] z-10 grid size-6 cursor-pointer place-items-center rounded-full border border-line-strong bg-ink-900 text-ink-300 shadow-card transition hover:scale-110 hover:border-gold-500/50 hover:text-gold-300 focus-visible:opacity-100"
      >
        <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.45, ease: EASE }} className="grid place-items-center">
          <ArrowLeft2 size={12} />
        </motion.span>
      </button>
    </NavTooltip>
  );
}

/** Radix tooltip that can be switched off without remounting its child (keeps layout animations smooth). */
function NavTooltip({ content, children, disabled }: { content: React.ReactNode; children: React.ReactNode; disabled?: boolean }) {
  return (
    <TooltipPrimitive.Root open={disabled ? false : undefined}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={10}
          className="z-[60] rounded-lg border border-line-strong bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-ink-100 shadow-lift data-[state=delayed-open]:animate-[popIn_.15s_ease-out]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function SidebarInner({
  area,
  nav,
  home,
  collapsed,
  sidebarTop,
  user,
  settingsHref,
  drawer,
}: {
  area: string;
  nav: NavSection[];
  home: string;
  collapsed: boolean;
  sidebarTop?: React.ReactNode;
  user: ShellUser;
  settingsHref: string;
  drawer?: boolean;
}) {
  const pathname = usePathname();
  const allItems = React.useMemo(() => nav.flatMap((s) => s.items), [nav]);
  // the longest matching href wins, so /app/developer doesn't also light up /app
  const activeHref = React.useMemo(() => {
    let best: string | null = null;
    for (const item of allItems) {
      const hit = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
      if (hit && (!best || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [allItems, pathname]);
  const fade = { animate: { opacity: collapsed ? 0 : 1 }, transition: { duration: collapsed ? 0.15 : 0.3, delay: collapsed ? 0 : 0.12 } };
  const layoutGroup = drawer ? "drawer" : "sidebar";

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-line pl-[29px]">
        <Link href={home} className="flex items-center gap-3.5 overflow-hidden rounded-lg" aria-label={`EKA BUILD — ${area}`}>
          <LogoMark shimmer className="h-9 shrink-0" />
          <motion.span {...fade} className={cn("flex flex-col gap-1.5 whitespace-nowrap", collapsed && "pointer-events-none")}>
            <Wordmark shimmer className="text-[13px]" />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.3em] text-ink-400">{area}</span>
          </motion.span>
        </Link>
      </div>

      {sidebarTop && (
        <motion.div
          initial={false}
          animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="shrink-0 overflow-hidden"
          aria-hidden={collapsed || undefined}
        >
          <div className="px-3 pt-4">{sidebarTop}</div>
        </motion.div>
      )}

      <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {nav.map((section, si) => (
          <div key={si} className="mb-4 last:mb-0">
            {section.title && (
              <div className="relative mb-1.5 h-6">
                <motion.div {...fade} className="absolute inset-0 flex items-center gap-2 whitespace-nowrap pl-[18px] pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-400">{section.title}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
                </motion.div>
                <motion.div
                  animate={{ opacity: collapsed ? 1 : 0, scaleX: collapsed ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 bg-line-strong"
                />
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                const hasBadge = item.badge != null && item.badge !== 0;
                return (
                  <li key={item.href}>
                    <NavTooltip content={item.label} disabled={!collapsed}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex h-10 items-center gap-3 overflow-hidden rounded-xl pl-[18px] pr-2.5 text-[13.5px] font-medium transition-colors",
                          active ? "text-stone-100" : "text-ink-300 hover:bg-fg/[0.045] hover:text-stone-100",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId={`${layoutGroup}-active`}
                            className="absolute inset-0 rounded-xl border border-gold-500/20 bg-gradient-to-r from-gold-500/[0.16] via-gold-500/[0.06] to-transparent shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]"
                            transition={{ type: "spring", stiffness: 380, damping: 34 }}
                          >
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-gradient shadow-[0_0_12px_rgb(201_164_100/0.6)]" />
                          </motion.span>
                        )}
                        <span className="relative shrink-0">
                          <Icon
                            size={20}
                            variant={active ? "Bulk" : "TwoTone"}
                            className={cn("transition-colors duration-300", active ? "text-gold-300" : "text-ink-400 group-hover:text-gold-300")}
                          />
                          {hasBadge && collapsed && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-gold-400 ring-2 ring-ink-900" />}
                        </span>
                        <motion.span {...fade} className="relative flex-1 truncate whitespace-nowrap">
                          {item.label}
                        </motion.span>
                        {hasBadge && (
                          <motion.span
                            {...fade}
                            className="relative grid h-5 min-w-5 place-items-center rounded-full bg-gold-gradient px-1.5 font-mono text-[10px] font-bold text-onyx"
                          >
                            {item.badge}
                          </motion.span>
                        )}
                      </Link>
                    </NavTooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        {drawer && (
          <div className="mb-3 flex items-center gap-2">
            <LanguageSwitcher className="flex-1 justify-center" />
            <ThemeToggle />
          </div>
        )}
        <UserCard user={user} collapsed={collapsed} settingsHref={settingsHref} />
      </div>
    </>
  );
}

const ORG_TONE: Record<string, string> = { VERIFIED: "text-success", PENDING: "text-warning", REJECTED: "text-danger" };

function Avatar({ user, className }: { user: ShellUser; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gold-gradient text-xs font-bold tracking-wide text-onyx shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
        className,
      )}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(user.fullName)
      )}
    </span>
  );
}

/** Sidebar footer: avatar, name, role and organization with its verification state; opens the account menu. */
function UserCard({ user, collapsed, settingsHref }: { user: ShellUser; collapsed: boolean; settingsHref: string }) {
  const { label, tr } = useI18n();
  const org = user.organization;
  const tone = org?.status ? ORG_TONE[org.status] : undefined;
  return (
    <DropdownMenu>
      <NavTooltip content={user.fullName} disabled={!collapsed}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-transparent py-2 pl-[10px] pr-2 text-left transition hover:border-line hover:bg-fg/[0.04] data-[state=open]:border-line data-[state=open]:bg-fg/[0.04]"
          >
            <span className="relative">
              <Avatar user={user} />
              {org?.status && <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-ink-900", org.status === "VERIFIED" ? "bg-success" : org.status === "REJECTED" ? "bg-danger" : "bg-warning")} />}
            </span>
            <motion.span
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={{ duration: collapsed ? 0.15 : 0.3, delay: collapsed ? 0 : 0.12 }}
              className="min-w-0 flex-1 leading-tight"
            >
              <span className="block truncate text-[13px] font-semibold text-stone-100">{user.fullName}</span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-400">
                {org ? (
                  <>
                    {org.status && <Verify size={12} variant="Bold" className={cn("shrink-0", tone)} />}
                    <span className="truncate">{tr(org.name)}</span>
                  </>
                ) : (
                  label("role", user.role)
                )}
              </span>
            </motion.span>
            <More size={16} className="shrink-0 rotate-90 text-ink-400 transition group-hover:text-gold-300" />
          </button>
        </DropdownMenuTrigger>
      </NavTooltip>
      <UserMenuContent user={user} settingsHref={settingsHref} side="top" align="start" />
    </DropdownMenu>
  );
}

function UserMenu({ user, settingsHref }: { user: ShellUser; settingsHref: string }) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("app.layout.account")}
          className="cursor-pointer rounded-xl p-0.5 ring-1 ring-line transition hover:ring-gold-500/50 data-[state=open]:ring-gold-500/60"
        >
          <Avatar user={user} className="size-9" />
        </button>
      </DropdownMenuTrigger>
      <UserMenuContent user={user} settingsHref={settingsHref} align="end" />
    </DropdownMenu>
  );
}

function UserMenuContent({ user, settingsHref, side, align }: { user: ShellUser; settingsHref: string; side?: "top" | "bottom"; align: "start" | "end" }) {
  const router = useRouter();
  const { t, label, tr } = useI18n();
  const org = user.organization;
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  };
  return (
    <DropdownMenuContent side={side} align={align} className="min-w-64">
      <DropdownMenuLabel className="flex items-center gap-3">
        <Avatar user={user} className="size-10" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-stone-100">{user.fullName}</span>
          <span className="block text-[11px] text-gold-300">{label("role", user.role)}</span>
          {user.phone && <span className="block font-mono text-[11px]">{user.phone}</span>}
        </span>
      </DropdownMenuLabel>
      {org && (
        <div className="mx-1.5 mb-1 rounded-lg border border-line bg-fg/[0.03] px-2.5 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-stone-100">
            {org.status && <Verify size={13} variant="Bold" className={cn("shrink-0", ORG_TONE[org.status])} />}
            <span className="truncate">{tr(org.name)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-ink-400">
            {org.tin && <span className="font-mono">STIR {org.tin}</span>}
            {org.status && <span className={ORG_TONE[org.status]}>{label("verification", org.status)}</span>}
          </div>
        </div>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => router.push(settingsHref)}>
        <Setting2 variant="TwoTone" className="!text-gold-400" /> {t("common.nav.settings")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push("/")}>
        <Global variant="TwoTone" className="!text-gold-400" /> <span className="flex-1">{t("app.layout.site")}</span>
        <ArrowRight2 className="!size-3" />
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={logout} className="text-danger data-[highlighted]:text-danger">
        <LogoutCurve className="!text-danger" /> {t("common.nav.logout")}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
