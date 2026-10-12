export const LOCALES = ["uz", "oz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "eka_locale";

/** uz = O'zbek (lotin), oz = Ўзбек (кирилл, generated from uz), ru = Русский */
export const LOCALE_META: Record<Locale, { label: string; short: string; htmlLang: string }> = {
  uz: { label: "O'zbekcha", short: "UZ", htmlLang: "uz-Latn" },
  oz: { label: "Ўзбекча", short: "ЎЗ", htmlLang: "uz-Cyrl" },
  ru: { label: "Русский", short: "RU", htmlLang: "ru" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
