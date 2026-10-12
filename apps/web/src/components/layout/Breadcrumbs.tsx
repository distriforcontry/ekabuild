"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight2, Home2 } from "iconsax-reactjs";
import type { Icon as IconType } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type Crumb = { href?: string; label: string; icon?: IconType };

// ───────────── dynamic page titles ─────────────
// Pages that live below a nav item (e.g. /app/purchases/[id]) announce their own title:
//   useBreadcrumb(purchase ? purchase.number : null)

type Ctx = { titles: Record<string, string>; setTitle: (path: string, label: string | null) => void };
const BreadcrumbContext = React.createContext<Ctx | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [titles, setTitles] = React.useState<Record<string, string>>({});
  const setTitle = React.useCallback((path: string, label: string | null) => {
    setTitles((prev) => {
      if (label == null) {
        if (!(path in prev)) return prev;
        const next = { ...prev };
        delete next[path];
        return next;
      }
      return prev[path] === label ? prev : { ...prev, [path]: label };
    });
  }, []);
  const value = React.useMemo(() => ({ titles, setTitle }), [titles, setTitle]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

/** Give the current page a human title in the top-bar breadcrumbs (no-op outside a DashboardShell). */
export function useBreadcrumb(label: string | null | undefined) {
  const ctx = React.useContext(BreadcrumbContext);
  const pathname = usePathname();
  const setTitle = ctx?.setTitle;
  React.useEffect(() => {
    if (!setTitle) return;
    setTitle(pathname, label ?? null);
    return () => setTitle(pathname, null);
  }, [setTitle, pathname, label]);
}

/** Title registered by the current page, if any. */
export function usePageTitle(): string | undefined {
  const ctx = React.useContext(BreadcrumbContext);
  const pathname = usePathname();
  return ctx?.titles[pathname];
}

// ───────────── derive crumbs from nav + pathname ─────────────

type NavLike = { href: string; label: string; exact?: boolean; icon?: IconType };

export function matchNav<T extends NavLike>(items: T[], pathname: string): T | undefined {
  let best: T | undefined;
  for (const item of items) {
    if (/^https?:/.test(item.href)) continue;
    const hit = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

export function useCrumbs(items: NavLike[], home: { href: string; label: string }): Crumb[] {
  const pathname = usePathname();
  const title = usePageTitle();
  return React.useMemo(() => {
    const crumbs: Crumb[] = [{ href: home.href, label: home.label, icon: Home2 }];
    const item = matchNav(items, pathname);
    if (item && item.href !== home.href) crumbs.push({ href: item.href, label: item.label });
    if (item && item.href === home.href && pathname === home.href) crumbs.push({ label: item.label });
    if (title && (!item || pathname !== item.href)) crumbs.push({ label: title });
    return crumbs;
  }, [items, home.href, home.label, pathname, title]);
}

export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("app.layout.breadcrumbs")} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        <AnimatePresence initial={false} mode="popLayout">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            const Icon = c.icon;
            return (
              <motion.li
                key={`${i}-${c.label}`}
                layout="position"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex min-w-0 items-center gap-1", last ? "shrink" : "shrink-0")}
              >
                {i > 0 && <ArrowRight2 size={12} className="shrink-0 text-ink-500" aria-hidden />}
                {c.href && !last ? (
                  <Link
                    href={c.href}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-ink-300 transition hover:bg-fg/5 hover:text-stone-100"
                  >
                    {Icon && <Icon size={15} variant="Bulk" className="text-gold-400" />}
                    <span className="max-w-48 truncate">{c.label}</span>
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1 font-semibold text-stone-100">
                    {Icon && <Icon size={15} variant="Bulk" className="text-gold-400" />}
                    <span className="truncate">{c.label}</span>
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </nav>
  );
}
