import type { Locale } from "./config";
import type { Messages } from "./messages";
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

export function createTranslator(locale: Locale, messages: Messages) {
  /** t("common.nav.home"), t("table.rows", { from: 1, to: 10, total: 42 }) */
  function t(key: MessageKey, vars?: Vars): string {
    const v = lookup(messages, key);
    return typeof v === "string" ? interpolate(v, vars) : key;
  }
  /** Raw access to arrays/objects in messages (e.g. FAQ lists) */
  function raw<T = unknown>(key: string): T {
    return lookup(messages, key) as T;
  }
  /** Enum label: label("projectStatus", "UNDER_CONSTRUCTION") */
  function label(kind: LabelKind, value: string | null | undefined): string {
    if (!value) return "—";
    const group = messages.labels[kind] as Record<string, string>;
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
