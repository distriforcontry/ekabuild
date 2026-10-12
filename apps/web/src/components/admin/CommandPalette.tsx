"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import {
  Add,
  ArrowRight,
  Award,
  Buildings2,
  Building4,
  Flag,
  Global,
  LanguageCircle,
  Messages2,
  Moon,
  SearchNormal1,
  ShieldTick,
  Sun1,
} from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, navLabelKey } from "./nav";
import { siteOrigin } from "./format";

type Item = {
  id: string;
  group: "pages" | "actions";
  label: string;
  hint?: string;
  icon: IconType;
  keywords?: string;
  run: () => void;
};

const norm = (s: string) => s.toLowerCase().replace(/['‘’ʻʼ`]/g, "").normalize("NFKD");

/** ⌘K / Ctrl+K command palette: jump to any admin page or run a quick action. */
export function CommandPalette() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const items = React.useMemo<Item[]>(() => {
    const pages: Item[] = ADMIN_NAV.flatMap((s) =>
      s.items.map((n) => ({
        id: `p-${n.key}`,
        group: "pages" as const,
        label: t(navLabelKey(n.key)),
        hint: t(s.title),
        icon: n.icon,
        keywords: n.keywords,
        run: () => go(n.href),
      })),
    );
    const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]!;
    const dark = resolvedTheme !== "light";
    const actions: Item[] = [
      { id: "a-pending-orgs", group: "actions", label: t("admin.palette.pendingOrgs"), icon: Buildings2, run: () => go("/admin/organizations?status=PENDING") },
      { id: "a-pending-projects", group: "actions", label: t("admin.palette.pendingProjects"), icon: Building4, run: () => go("/admin/projects?verification=PENDING") },
      { id: "a-pending-certs", group: "actions", label: t("admin.palette.pendingCerts"), icon: Award, run: () => go("/admin/certificates?status=PENDING") },
      { id: "a-complaints", group: "actions", label: t("admin.palette.openComplaints"), icon: Flag, run: () => go("/admin/complaints?status=OPEN") },
      { id: "a-support", group: "actions", label: t("admin.palette.openSupport"), icon: Messages2, run: () => go("/admin/support?status=OPEN") },
      { id: "a-template", group: "actions", label: t("admin.palette.newTemplate"), icon: Add, run: () => go("/admin/templates/new") },
      { id: "a-rule", group: "actions", label: t("admin.palette.newRule"), icon: Add, run: () => go("/admin/rules?new=1") },
      { id: "a-chain", group: "actions", label: t("admin.palette.verifyChain"), icon: ShieldTick, keywords: "audit hash", run: () => go("/admin/audit?verify=1") },
      {
        id: "a-theme",
        group: "actions",
        label: t("admin.palette.toggleTheme"),
        hint: dark ? t("common.theme.light") : t("common.theme.dark"),
        icon: dark ? Sun1 : Moon,
        keywords: "theme dark light",
        run: () => {
          setTheme(dark ? "light" : "dark");
          setOpen(false);
        },
      },
      {
        id: "a-lang",
        group: "actions",
        label: t("admin.palette.switchLanguage", { lang: LOCALE_META[nextLocale].label }),
        icon: LanguageCircle,
        keywords: "language til язык",
        run: () => {
          setLocale(nextLocale);
          setOpen(false);
        },
      },
      {
        id: "a-site",
        group: "actions",
        label: t("admin.palette.openSite"),
        icon: Global,
        run: () => {
          setOpen(false);
          window.open(siteOrigin(), "_blank", "noopener");
        },
      },
    ];
    return [...pages, ...actions];
  }, [t, go, locale, setLocale, resolvedTheme, setTheme]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const q = norm(query.trim());
    return items.filter((i) => norm(`${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`).includes(q));
  }, [items, query]);

  React.useEffect(() => setActive(0), [query, open]);
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  const groups: { key: Item["group"]; title: string }[] = [
    { key: "pages", title: t("admin.palette.pages") },
    { key: "actions", title: t("admin.palette.actions") },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group hidden h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-ink-900/60 pl-3 pr-2 text-sm text-ink-400 transition hover:border-line-strong hover:text-stone-100 md:inline-flex md:w-56 xl:w-72"
        aria-label={t("admin.palette.title")}
      >
        <SearchNormal1 size={16} className="transition group-hover:text-gold-300" />
        <span className="flex-1 text-left">{t("admin.topbar.search")}</span>
        <kbd className="rounded-md border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 transition hover:border-line-strong hover:bg-fg/5 md:hidden"
        aria-label={t("admin.palette.title")}
      >
        <SearchNormal1 size={18} />
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div className="fixed inset-0 z-50 bg-onyx/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content asChild forceMount onKeyDown={onKeyDown}>
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-ink-900/95 shadow-lift backdrop-blur-xl focus:outline-none"
                >
                  <DialogPrimitive.Title className="sr-only">{t("admin.palette.title")}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">{t("admin.palette.placeholder")}</DialogPrimitive.Description>
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <SearchNormal1 size={18} className="text-gold-300" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("admin.palette.placeholder")}
                      role="combobox"
                      aria-expanded
                      aria-controls="admin-palette-list"
                      aria-activedescendant={filtered[active] ? `pal-${filtered[active]!.id}` : undefined}
                      className="h-14 flex-1 bg-transparent text-[15px] text-stone-100 placeholder:text-ink-400 focus:outline-none"
                    />
                    <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-400">ESC</kbd>
                  </div>
                  <div ref={listRef} id="admin-palette-list" role="listbox" className="max-h-[56vh] overflow-y-auto p-2">
                    {filtered.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm text-ink-400">{t("admin.palette.empty")}</div>
                    ) : (
                      groups.map((g) => {
                        const list = filtered.filter((i) => i.group === g.key);
                        if (!list.length) return null;
                        return (
                          <div key={g.key} className="mb-1 last:mb-0">
                            <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">{g.title}</div>
                            {list.map((item) => {
                              const index = filtered.indexOf(item);
                              const isActive = index === active;
                              const Icon = item.icon;
                              return (
                                <div
                                  key={item.id}
                                  id={`pal-${item.id}`}
                                  role="option"
                                  aria-selected={isActive}
                                  data-index={index}
                                  onMouseMove={() => setActive(index)}
                                  onClick={item.run}
                                  className={cn(
                                    "relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                                    isActive ? "text-stone-100" : "text-ink-200",
                                  )}
                                >
                                  {isActive && (
                                    <motion.span
                                      layoutId="palette-active"
                                      className="absolute inset-0 rounded-xl border border-gold-500/20 bg-gold-500/10"
                                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                                    />
                                  )}
                                  <span
                                    className={cn(
                                      "relative grid size-8 place-items-center rounded-lg border transition",
                                      isActive ? "border-gold-500/30 bg-gold-500/10 text-gold-300" : "border-line bg-ink-850 text-ink-300",
                                    )}
                                  >
                                    <Icon size={16} variant={isActive ? "Bulk" : "Linear"} />
                                  </span>
                                  <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                                  {item.hint && <span className="relative hidden text-xs text-ink-400 sm:inline">{item.hint}</span>}
                                  <ArrowRight size={14} className={cn("relative transition", isActive ? "text-gold-300 opacity-100" : "opacity-0")} />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-400">
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">↑↓</kbd> {t("admin.palette.navigate")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">↵</kbd> {t("admin.palette.open")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">esc</kbd> {t("admin.palette.close")}
                    </span>
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </>
  );
}
