"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight, LanguageCircle, Moon, SearchNormal1, Sun1 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { cn } from "@/lib/utils";

export type PaletteItem = {
  id: string;
  label: string;
  icon: IconType;
  /** small text on the right (section name, shortcut…) */
  hint?: string;
  /** extra words to match (other languages, synonyms) */
  keywords?: string;
  /** navigate here… */
  href?: string;
  /** …or run this */
  run?: () => void;
};
export type PaletteGroup = { id: string; title: string; items: PaletteItem[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['‘’ʻʼ`]/g, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

const OPEN_EVENT = "eka:command-palette";
/** Open the palette from anywhere (e.g. a mobile menu button). */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

/**
 * ⌘K / Ctrl+K command palette for dashboards: jump to any page or run a quick action.
 * Theme and language switches are always appended. Renders its own trigger (search pill on desktop, icon on mobile).
 */
export function CommandPalette({ groups, className }: { groups: PaletteGroup[]; className?: string }) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [mac, setMac] = React.useState(true);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const all = React.useMemo<PaletteGroup[]>(() => {
    const dark = resolvedTheme !== "light";
    const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]!;
    const prefs: PaletteGroup = {
      id: "prefs",
      title: t("app.layout.palette.preferences"),
      items: [
        {
          id: "theme",
          label: t("app.layout.palette.toggleTheme"),
          hint: dark ? t("common.theme.light") : t("common.theme.dark"),
          icon: dark ? Sun1 : Moon,
          keywords: "theme dark light mavzu тема",
          run: () => setTheme(dark ? "light" : "dark"),
        },
        {
          id: "lang",
          label: t("app.layout.palette.switchLanguage", { lang: LOCALE_META[nextLocale].label }),
          icon: LanguageCircle,
          keywords: "language til язык",
          run: () => setLocale(nextLocale),
        },
      ],
    };
    return [...groups, prefs];
  }, [groups, resolvedTheme, setTheme, locale, setLocale, t]);

  const filtered = React.useMemo(() => {
    const q = norm(query.trim());
    return all
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => norm(`${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`).includes(q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [all, query]);
  const flat = React.useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  React.useEffect(() => setActive(0), [query, open]);
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const exec = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    if (item.href) router.push(item.href);
    else item.run?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(flat[active]);
    }
  };

  const kbd = mac ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group hidden h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-ink-900/60 pl-3 pr-1.5 text-sm text-ink-400 shadow-card transition hover:border-gold-500/30 hover:text-stone-100 md:inline-flex md:w-60 xl:w-72",
          className,
        )}
        aria-label={t("app.layout.palette.title")}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <SearchNormal1 size={16} className="text-gold-400 transition group-hover:text-gold-300" />
        <span className="flex-1 truncate text-left">{t("app.layout.search")}</span>
        <kbd className="rounded-md border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">{kbd}</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 transition hover:border-line-strong hover:bg-fg/5 md:hidden"
        aria-label={t("app.layout.palette.title")}
      >
        <SearchNormal1 size={18} className="text-gold-400" />
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[60] bg-onyx/55 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content asChild forceMount onKeyDown={onKeyDown}>
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed left-1/2 top-[10vh] z-[60] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-ink-900/95 shadow-lift backdrop-blur-xl focus:outline-none"
                >
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                  <DialogPrimitive.Title className="sr-only">{t("app.layout.palette.title")}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">{t("app.layout.palette.placeholder")}</DialogPrimitive.Description>
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <SearchNormal1 size={18} className="shrink-0 text-gold-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("app.layout.palette.placeholder")}
                      role="combobox"
                      aria-expanded
                      aria-controls="eka-palette-list"
                      aria-activedescendant={flat[active] ? `pal-${flat[active]!.id}` : undefined}
                      className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-stone-100 placeholder:text-ink-400 focus:outline-none"
                    />
                    <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-400 sm:inline">ESC</kbd>
                  </div>
                  <div ref={listRef} id="eka-palette-list" role="listbox" className="max-h-[min(56vh,460px)] overflow-y-auto overscroll-contain p-2">
                    {flat.length === 0 ? (
                      <div className="px-4 py-12 text-center">
                        <SearchNormal1 size={28} variant="Bulk" className="mx-auto text-gold-400/70" />
                        <div className="mt-3 text-sm text-ink-300">{t("app.layout.palette.empty")}</div>
                      </div>
                    ) : (
                      filtered.map((g) => (
                        <div key={g.id} role="group" aria-label={g.title} className="mb-1 last:mb-0">
                          <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">{g.title}</div>
                          {g.items.map((item) => {
                            const index = flat.indexOf(item);
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
                                onClick={() => exec(item)}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                                  isActive ? "text-stone-100" : "text-ink-200",
                                )}
                              >
                                {isActive && (
                                  <motion.span
                                    layoutId="eka-palette-active"
                                    className="absolute inset-0 rounded-xl border border-gold-500/20 bg-gold-500/10"
                                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                                  />
                                )}
                                <span
                                  className={cn(
                                    "relative grid size-8 shrink-0 place-items-center rounded-lg border transition",
                                    isActive ? "border-gold-500/30 bg-gold-500/10 text-gold-300" : "border-line bg-ink-850 text-gold-400/80",
                                  )}
                                >
                                  <Icon size={16} variant={isActive ? "Bulk" : "TwoTone"} />
                                </span>
                                <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                                {item.hint && <span className="relative hidden shrink-0 text-xs text-ink-400 sm:inline">{item.hint}</span>}
                                <ArrowRight size={14} className={cn("relative shrink-0 transition", isActive ? "text-gold-300 opacity-100" : "opacity-0")} />
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-400 sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">↑↓</kbd> {t("app.layout.palette.navigate")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">↵</kbd> {t("app.layout.palette.open")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <kbd className="rounded border border-line px-1 font-mono">esc</kbd> {t("app.layout.palette.close")}
                    </span>
                    <span className="ml-auto font-mono text-ink-500">{kbd}</span>
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
