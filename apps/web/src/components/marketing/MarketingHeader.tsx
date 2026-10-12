"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowRight, Call, CloseCircle, HamburgerMenu, Login, ProfileCircle, Sms } from "iconsax-reactjs";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useI18n } from "@/i18n/client";
import { cn, initials } from "@/lib/utils";

export type HeaderUser = { name: string; home: string } | null;

const NAV = [
  { href: "/projects", key: "projects" },
  { href: "/verify", key: "verify" },
  { href: "/developers", key: "developers" },
  { href: "/rules", key: "rules" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function MarketingHeader({ user }: { user: HeaderUser }) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  React.useEffect(() => setScrolled(window.scrollY > 12), []);
  React.useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:text-stone-100"
      >
        {t("landing.header.skip")}
      </a>
      <div
        className={cn(
          "border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-[var(--ease-out-expo)]",
          scrolled ? "glass border-x-0 border-t-0 border-b-line shadow-card" : "border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 transition-[height] duration-500 ease-[var(--ease-out-expo)] sm:px-6 lg:px-8",
            scrolled ? "h-16" : "h-20",
          )}
        >
          <Link href="/" aria-label="EKA BUILD" className="shrink-0 rounded-lg">
            <Logo className={cn("origin-left transition-transform duration-500 ease-[var(--ease-out-expo)] lg:hidden xl:inline-flex", scrolled && "scale-[0.92]")} />
            <LogoMark className="hidden h-9 lg:block xl:hidden" />
          </Link>

          <nav aria-label={t("landing.header.mainNav")} className="ml-3 hidden items-center lg:flex xl:ml-6 2xl:ml-8" onMouseLeave={() => setHovered(null)}>
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={() => setHovered(item.href)}
                  onFocus={() => setHovered(item.href)}
                  className={cn(
                    "relative whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors 2xl:px-3.5 2xl:text-sm",
                    active ? "text-stone-100" : "text-ink-300 hover:text-stone-100",
                  )}
                >
                  {hovered === item.href && (
                    <motion.span
                      layoutId="eka-nav-hover"
                      className="absolute inset-0 rounded-lg bg-fg/5"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className="relative">{t(`common.nav.${item.key}`)}</span>
                  {active && (
                    <motion.span
                      layoutId="eka-nav-active"
                      className="absolute inset-x-2.5 -bottom-[3px] h-[2px] rounded-full bg-gold-gradient 2xl:inset-x-3.5"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={t("common.contact.phoneHref")}
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1.5 font-mono text-[13px] font-medium text-ink-200 transition hover:text-gold-300 xl:inline-flex"
              aria-label={`${t("landing.header.callUs")}: ${t("common.contact.phone")}`}
            >
              <Call size={16} variant="Bulk" className="text-gold-400" />
              {t("common.contact.phone")}
            </a>
            <LanguageSwitcher className="hidden sm:inline-flex lg:hidden 2xl:inline-flex" />
            <LanguageSwitcher compact className="hidden lg:inline-flex 2xl:hidden" />
            <ThemeToggle className="hidden sm:grid" />
            {user ? (
              <Button asChild variant="gold" size="md" className="hidden sm:inline-flex">
                <Link href={user.home}>
                  <span className="grid size-6 place-items-center rounded-full bg-onyx/15 text-[10px] font-bold">{initials(user.name) || "•"}</span>
                  {t("common.nav.cabinet")}
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="md" className="hidden md:inline-flex">
                  <Link href="/login">{t("common.nav.login")}</Link>
                </Button>
                <Button asChild variant="gold" size="md" className="hidden sm:inline-flex">
                  <Link href="/register">{t("common.nav.register")}</Link>
                </Button>
              </>
            )}
            <MobileMenu open={open} onOpenChange={setOpen} user={user} isActive={isActive} />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({
  open,
  onOpenChange,
  user,
  isActive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: HeaderUser;
  isActive: (href: string) => boolean;
}) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={t("landing.header.menu")}
          className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-100 transition hover:border-line-strong hover:bg-fg/5 lg:hidden"
        >
          <HamburgerMenu size={20} className="text-gold-300" />
        </button>
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-onyx/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col overflow-y-auto border-l border-line bg-ink-950 shadow-lift focus:outline-none"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
              >
                <DialogPrimitive.Title className="sr-only">{t("common.sidebar.menu")}</DialogPrimitive.Title>
                <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
                <div className="relative flex h-20 items-center justify-between px-5">
                  <Logo />
                  <DialogPrimitive.Close
                    aria-label={t("landing.header.closeMenu")}
                    className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 transition hover:bg-fg/5 hover:text-stone-100"
                  >
                    <CloseCircle size={20} variant="Bulk" className="text-gold-300" />
                  </DialogPrimitive.Close>
                </div>

                <nav aria-label={t("landing.header.mainNav")} className="relative px-3 pt-2">
                  <ul>
                    {[{ href: "/", key: "home" as const }, ...NAV].map((item, i) => {
                      const active = item.href === "/" ? false : isActive(item.href);
                      return (
                        <motion.li
                          key={item.href}
                          initial={{ opacity: 0, x: 28 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.06 + i * 0.045, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <Link
                            href={item.href}
                            onClick={() => onOpenChange(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "group flex items-center gap-4 rounded-2xl px-3 py-3.5 transition hover:bg-fg/5",
                              active && "bg-fg/5",
                            )}
                          >
                            <span className="w-6 font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                            <span className={cn("flex-1 font-display text-[28px] leading-none", active ? "text-gold-gradient" : "text-stone-100")}>
                              {t(`common.nav.${item.key}`)}
                            </span>
                            <ArrowRight size={18} className="-translate-x-2 text-gold-400 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </nav>

                <motion.div
                  className="relative mt-auto space-y-4 p-5"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                >
                  <div className="rounded-2xl border border-line bg-ink-900/80 p-4">
                    <a href={t("common.contact.phoneHref")} className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-gold-gradient text-onyx">
                        <Call size={18} variant="Bold" />
                      </span>
                      <span>
                        <span className="block text-xs text-ink-400">{t("landing.header.callUs")}</span>
                        <span className="font-mono text-base font-semibold text-stone-100">{t("common.contact.phone")}</span>
                      </span>
                    </a>
                    <a href={`mailto:${t("common.contact.email")}`} className="mt-3 flex items-center gap-3 text-sm text-ink-300 hover:text-gold-300">
                      <Sms size={16} variant="Bulk" className="ml-3 text-gold-400" />
                      {t("common.contact.email")}
                    </a>
                  </div>
                  {user ? (
                    <Button asChild variant="gold" size="lg" className="w-full">
                      <Link href={user.home} onClick={() => onOpenChange(false)}>
                        <ProfileCircle variant="Bulk" />
                        {t("common.nav.cabinet")}
                      </Link>
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button asChild variant="secondary" size="lg">
                        <Link href="/login" onClick={() => onOpenChange(false)}>
                          <Login variant="Bulk" />
                          {t("common.nav.login")}
                        </Link>
                      </Button>
                      <Button asChild variant="gold" size="lg">
                        <Link href="/register" onClick={() => onOpenChange(false)}>
                          {t("common.nav.register")}
                        </Link>
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                    <span className="text-xs text-ink-400">{t("common.contact.hours")}</span>
                    <div className="flex items-center gap-2">
                      <LanguageSwitcher />
                      <ThemeToggle />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
