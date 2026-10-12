"use client";
import { LanguageCircle, TickCircle } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown";

/** UZ / ЎЗ / RU switch — client components update instantly, server components refresh in place. */
export function LanguageSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { locale, setLocale, t, pending } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.language.label")}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-xs font-bold tracking-wider text-ink-200 transition hover:border-line-strong hover:bg-fg/5 hover:text-stone-100",
            pending && "opacity-70",
            className,
          )}
        >
          <LanguageCircle size={18} variant="Bulk" className={cn(pending && "animate-spin")} />
          {!compact && LOCALE_META[locale].short}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t("common.language.label")}</DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => setLocale(l)} className={cn(l === locale && "text-stone-100")}>
            <span className="w-7 font-mono text-[11px] text-ink-400">{LOCALE_META[l].short}</span>
            <span className="flex-1">{LOCALE_META[l].label}</span>
            {l === locale && <TickCircle size={16} variant="Bold" className="!text-gold-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
