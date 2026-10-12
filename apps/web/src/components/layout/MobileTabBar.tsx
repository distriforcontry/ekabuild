"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Category } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { NavItem } from "./DashboardShell";
import { matchNav } from "./Breadcrumbs";

/**
 * Bottom tab bar for phones/tablets (< lg): up to 4 primary destinations + "Menu" (opens the drawer).
 * Respects the iOS home-indicator safe area.
 */
export function MobileTabBar({ items, allItems, onMenu, menuOpen }: { items: NavItem[]; allItems: NavItem[]; onMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  // the active tab is the best nav match overall, so a deep page under a non-tab item doesn't light up a tab
  const current = matchNav(allItems, pathname);
  const activeHref = current && items.some((i) => i.href === current.href) ? current.href : null;

  return (
    <nav
      aria-label={t("app.layout.tabs.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-900/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-20px_rgb(0_0_0/0.45)] backdrop-blur-xl lg:hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/35 to-transparent" />
      <ul className="mx-auto grid h-16 max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = !menuOpen && activeHref === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex h-full flex-col items-center justify-center gap-1 px-1 active:scale-95 [transition:transform_.15s]"
              >
                {active && (
                  <motion.span
                    layoutId="eka-tab-active"
                    className="absolute top-0 h-0.5 w-8 rounded-b-full bg-gold-gradient shadow-glow"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">
                  <Icon size={22} variant={active ? "Bulk" : "TwoTone"} className={cn("transition-colors", active ? "text-gold-300" : "text-ink-300 group-hover:text-gold-300")} />
                  {item.badge != null && item.badge !== 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-gradient px-1 font-mono text-[9px] font-bold text-onyx ring-2 ring-ink-900">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={cn("max-w-full truncate text-[10px] font-semibold", active ? "text-stone-100" : "text-ink-400")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onMenu}
            aria-expanded={menuOpen}
            className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 px-1 active:scale-95 [transition:transform_.15s]"
          >
            {menuOpen && <motion.span layoutId="eka-tab-active" className="absolute top-0 h-0.5 w-8 rounded-b-full bg-gold-gradient shadow-glow" />}
            <Category size={22} variant={menuOpen ? "Bulk" : "TwoTone"} className={cn("transition-colors", menuOpen ? "text-gold-300" : "text-ink-300 group-hover:text-gold-300")} />
            <span className={cn("text-[10px] font-semibold", menuOpen ? "text-stone-100" : "text-ink-400")}>{t("common.sidebar.menu")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
