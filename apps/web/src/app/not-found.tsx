import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { LogoMark } from "@/components/brand/Logo";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="bg-blueprint relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-ink-950)_70%)]" />
      <div className="relative text-center">
        <LogoMark className="mx-auto h-20 opacity-90" />
        <div className="mt-8 font-display text-8xl text-gold-gradient">404</div>
        <h1 className="mt-2 text-2xl font-bold text-stone-100">{t("common.errors.notFound")}</h1>
        <p className="mt-2 text-ink-300">{t("common.errors.notFoundHint")}</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-xl bg-gold-gradient px-6 font-semibold text-onyx shadow-glow">
          {t("common.nav.home")}
        </Link>
      </div>
    </main>
  );
}
