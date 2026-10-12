"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./config";
import type { PartialMessages } from "./messages";
import { createTranslator, type Translator } from "./core";
import { BASE_PATH, DEMO_ROOT, IS_DEMO } from "@/lib/static";

/**
 * Client i18n. The server sends only the messages a route segment needs, for the current locale only
 * (root layout → common/labels/catalog/auth, segment layouts add theirs through <I18nScope>), so no page
 * downloads every language. Switching language sets the cookie and refreshes server components, which
 * re-send the messages in the new locale.
 */
type Ctx = Translator & { setLocale: (l: Locale) => void; pending: boolean; messages: PartialMessages };
const I18nContext = React.createContext<Ctx | null>(null);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObject(out[k]) && isObject(v) ? deepMerge(out[k] as Record<string, unknown>, v) : v;
  return out;
}

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: PartialMessages; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const setLocale = React.useCallback(
    (l: Locale) => {
      if (IS_DEMO) {
        // static demo: one prerendered copy per locale (<root>, <root>/oz, <root>/ru)
        const rest = window.location.pathname.slice(BASE_PATH.length) || "/";
        window.location.assign(`${DEMO_ROOT}${l === "uz" ? "" : `/${l}`}${rest}${window.location.search}${window.location.hash}`);
        return;
      }
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      // server components (and the message subsets they pass down) re-render in the new locale
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = React.useMemo<Ctx>(() => ({ ...createTranslator(locale, messages), setLocale, pending, messages }), [locale, messages, setLocale, pending]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Adds a route segment's namespaces (e.g. landing, app, admin) on top of the parent messages. */
export function I18nScope({ messages, children }: { messages: PartialMessages; children: React.ReactNode }) {
  const parent = React.useContext(I18nContext);
  if (!parent) throw new Error("I18nScope must be inside <I18nProvider>");
  const merged = React.useMemo(
    () => deepMerge(parent.messages as Record<string, unknown>, messages as Record<string, unknown>) as PartialMessages,
    [parent.messages, messages],
  );
  const value = React.useMemo<Ctx>(
    () => ({ ...createTranslator(parent.locale, merged), setLocale: parent.setLocale, pending: parent.pending, messages: merged }),
    [parent.locale, parent.setLocale, parent.pending, merged],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client components: const { t, label, tr, locale, setLocale } = useI18n(); */
export function useI18n(): Ctx {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
