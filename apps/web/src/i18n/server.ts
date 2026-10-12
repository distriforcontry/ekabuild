import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { SCOPES, getMessages, pickMessages } from "./messages";
import { createTranslator } from "./core";

export const getLocale = cache(async (): Promise<Locale> => {
  // static export: one build per locale (deploy/pages/build.sh)
  if (process.env.STATIC_EXPORT === "1") return isLocale(process.env.STATIC_LOCALE) ? process.env.STATIC_LOCALE : DEFAULT_LOCALE;
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

/** Server components: const { t, label, tr } = await getI18n(); */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  return createTranslator(locale, getMessages(locale));
});

/** Message subset for a route segment, in the request's locale (passed to <I18nProvider>/<I18nScope>). */
export async function getScopeMessages(scope: keyof typeof SCOPES) {
  return pickMessages(await getLocale(), SCOPES[scope]);
}
