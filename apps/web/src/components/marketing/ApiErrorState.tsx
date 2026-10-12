import { Refresh, Warning2 } from "iconsax-reactjs";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

/** Friendly "API unreachable" card for server pages — never claims that data does not exist. */
export async function ApiErrorState({ retryHref, className }: { retryHref: string; className?: string }) {
  const { t } = await getI18n();
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-warning/25 bg-warning/[0.05] px-6 py-14 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
        <Warning2 size={26} variant="Bulk" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-stone-100">{t("landing.common.loadError")}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-400">{t("landing.common.loadErrorText")}</p>
      <a
        href={retryHref}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-ink-800 px-4 text-sm font-semibold text-ink-100 transition hover:border-line-strong hover:bg-ink-700"
      >
        <Refresh size={16} />
        {t("landing.common.reload")}
      </a>
    </div>
  );
}
