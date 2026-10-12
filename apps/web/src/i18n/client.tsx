"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator, type Translator } from "./core";

type Ctx = Translator & { setLocale: (l: Locale) => void; pending: boolean };
const I18nContext = React.createContext<Ctx | null>(null);

export function I18nProvider({ locale: initial, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = React.useState<Locale>(initial);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => setLocaleState(initial), [initial]);

  const setLocale = React.useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      setLocaleState(l); // client components switch instantly…
      startTransition(() => router.refresh()); // …server components re-render in the background
    },
    [router],
  );

  const value = React.useMemo<Ctx>(
    () => ({ ...createTranslator(locale, getMessages(locale)), setLocale, pending }),
    [locale, setLocale, pending],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client components: const { t, label, tr, locale, setLocale } = useI18n(); */
export function useI18n(): Ctx {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
