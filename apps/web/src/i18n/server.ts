import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator } from "./core";

export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

/** Server components: const { t, label, tr } = await getI18n(); */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  return createTranslator(locale, getMessages(locale));
});
