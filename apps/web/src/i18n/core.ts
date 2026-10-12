import type { Locale } from "./config";
import type { Messages, PartialMessages } from "./messages";
import type { Paths } from "./types";
import { latinToCyrillic } from "./translit";

export type MessageKey = Paths<Messages>;
export type Vars = Record<string, string | number>;
export type LabelKind = keyof Messages["labels"];

function lookup(messages: unknown, key: string): unknown {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function interpolate(str: string, vars?: Vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const warned = new Set<string>();

export function createTranslator(locale: Locale, messages: Messages | PartialMessages) {
  /** t("common.nav.home"), t("table.rows", { from: 1, to: 10, total: 42 }) */
  function t(key: MessageKey, vars?: Vars): string {
    const v = lookup(messages, key);
    if (typeof v === "string") return interpolate(v, vars);
    // a key outside the namespaces this route segment loaded (see SCOPES) — surface it in development
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing message "${key}" (${locale}) — add its namespace to the segment scope`);
    }
    return key;
  }
  /** Raw access to arrays/objects in messages (e.g. FAQ lists) */
  function raw<T = unknown>(key: string): T {
    return lookup(messages, key) as T;
  }
  /** Enum label: label("projectStatus", "UNDER_CONSTRUCTION") */
  function label(kind: LabelKind, value: string | null | undefined): string {
    if (!value) return "—";
    const group = messages.labels?.[kind] as Record<string, string> | undefined;
    return group?.[value] ?? value;
  }
  /** Transliterate free-form Uzbek DB content for the Cyrillic locale */
  function tr(text: string | null | undefined): string {
    if (!text) return "";
    return locale === "oz" ? latinToCyrillic(text) : text;
  }
  return { locale, t, raw, label, tr };
}

export type Translator = ReturnType<typeof createTranslator>;
