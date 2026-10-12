import Link from "next/link";
import { ArrowRight, Call, Clock, Instagram, Location, ScanBarcode, Send2, Sms, Youtube, Facebook } from "iconsax-reactjs";
import { Logo } from "@/components/brand/Logo";
import { getI18n } from "@/i18n/server";
import { Container } from "./primitives";

export async function Footer() {
  const { t } = await getI18n();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("common.footer.platform"),
      links: [
        { href: "/projects", label: t("common.nav.projects") },
        { href: "/verify", label: t("common.nav.verify") },
        { href: "/developers", label: t("common.nav.developers") },
        { href: "/rules", label: t("common.nav.rules") },
      ],
    },
    {
      title: t("common.footer.company"),
      links: [
        { href: "/about", label: t("common.nav.about") },
        { href: "/contact", label: t("common.nav.contact") },
        { href: "/about#trust-score", label: t("landing.features.trust.title") },
        { href: "/#faq", label: t("landing.faq.title") },
      ],
    },
    {
      title: t("landing.footer.account"),
      links: [
        { href: "/login", label: t("common.nav.login") },
        { href: "/register", label: t("common.nav.register") },
        { href: "/app", label: t("common.nav.cabinet") },
      ],
    },
  ];

  const socials = [
    { href: t("common.contact.telegram"), label: "Telegram", Icon: Send2 },
    { href: "https://instagram.com/ekabuild", label: "Instagram", Icon: Instagram },
    { href: "https://facebook.com/ekabuild", label: "Facebook", Icon: Facebook },
    { href: "https://youtube.com/@ekabuild", label: "YouTube", Icon: Youtube },
  ];

  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-line bg-ink-950">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-80 w-[720px] -translate-x-1/2 rounded-full bg-gold-500 opacity-[0.06] blur-[110px]" />

      <Container className="pt-16 md:pt-20">
        {/* verify banner */}
        <div className="mb-14 flex flex-col items-start justify-between gap-5 rounded-3xl border border-gold-500/20 bg-gradient-to-r from-gold-500/10 via-gold-500/[0.04] to-transparent p-6 sm:flex-row sm:items-center md:p-8">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
              <ScanBarcode size={22} variant="Bold" />
            </span>
            <div>
              <div className="font-display text-2xl text-stone-100 md:text-3xl">{t("landing.footer.verifyTitle")}</div>
              <p className="mt-1 text-sm text-ink-300">{t("landing.footer.verifyText")}</p>
            </div>
          </div>
          <Link
            href="/verify"
            className="group inline-flex h-12 items-center gap-2 rounded-xl border border-gold-500/40 px-5 text-sm font-semibold text-gold-200 transition hover:border-gold-400 hover:bg-gold-500/10"
          >
            {t("landing.footer.verifyCta")}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" aria-label="EKA BUILD" className="inline-block rounded-lg">
              <Logo tagline />
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-300">{t("landing.footer.about")}</p>
            <div className="mt-6 flex items-center gap-2" aria-label={t("landing.footer.follow")}>
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-xl border border-line text-ink-300 transition hover:-translate-y-0.5 hover:border-gold-500/40 hover:text-gold-300"
                >
                  <Icon size={18} variant="Bulk" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-ink-200 transition hover:text-gold-300">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("landing.footer.contacts")}</h3>
            <ul className="mt-4 space-y-3.5 text-sm">
              <li>
                <a href={t("common.contact.phoneHref")} className="group flex items-center gap-3 text-stone-100">
                  <Call size={16} variant="Bulk" className="text-gold-400" />
                  <span className="font-mono font-semibold tracking-wide transition group-hover:text-gold-300">{t("common.contact.phone")}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${t("common.contact.email")}`} className="flex items-center gap-3 text-ink-200 transition hover:text-gold-300">
                  <Sms size={16} variant="Bulk" className="text-gold-400" />
                  {t("common.contact.email")}
                </a>
              </li>
              <li className="flex items-center gap-3 text-ink-200">
                <Clock size={16} variant="Bulk" className="text-gold-400" />
                {t("common.contact.hours")}
              </li>
              <li className="flex items-center gap-3 text-ink-200">
                <Location size={16} variant="Bulk" className="text-gold-400" />
                {t("common.contact.address")}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line py-6 text-xs text-ink-400 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} EKA BUILD. {t("common.footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-[11px] uppercase tracking-[0.18em]">{t("common.footer.legal")}:</span>
            <Link href="/about#privacy" className="transition hover:text-gold-300">
              {t("common.footer.privacy")}
            </Link>
            <Link href="/about#terms" className="transition hover:text-gold-300">
              {t("common.footer.terms")}
            </Link>
            <span className="hidden text-ink-500 md:inline">·</span>
            <span>{t("landing.footer.madeIn")}</span>
          </div>
        </div>
      </Container>

      {/* oversized watermark */}
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <div className="text-gold-gradient -mb-[0.22em] text-center font-display text-[22vw] leading-none opacity-[0.12] lg:text-[17rem]">EKA BUILD</div>
      </div>
    </footer>
  );
}
