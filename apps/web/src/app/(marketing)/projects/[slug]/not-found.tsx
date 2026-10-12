import Link from "next/link";
import { ArrowLeft, SearchStatus } from "iconsax-reactjs";
import { getI18n } from "@/i18n/server";

export default async function ProjectNotFound() {
  const { t } = await getI18n();
  return (
    <div className="relative isolate grid min-h-[80dvh] place-items-center overflow-hidden px-4 pb-24 pt-32">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-300">
          <SearchStatus size={28} variant="Bulk" />
        </div>
        <div className="font-display text-7xl leading-none text-gold-gradient">404</div>
        <h1 className="mt-3 font-display text-3xl text-stone-100">{t("catalog.detail.notFound.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{t("catalog.detail.notFound.hint")}</p>
        <Link
          href="/projects"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-gold-gradient px-6 font-semibold text-onyx shadow-glow transition hover:brightness-110"
        >
          <ArrowLeft size={18} />
          {t("catalog.detail.error.back")}
        </Link>
      </div>
    </div>
  );
}
