import type { Locale } from "../config";
import { translitDeep } from "../translit";

import uzCommon from "./uz/common";
import uzLabels from "./uz/labels";
import uzLanding from "./uz/landing";
import uzAuth from "./uz/auth";
import uzCatalog from "./uz/catalog";
import uzApp from "./uz/app";
import uzAdmin from "./uz/admin";
import uzStudio from "./uz/studio";

import ruCommon from "./ru/common";
import ruLabels from "./ru/labels";
import ruLanding from "./ru/landing";
import ruAuth from "./ru/auth";
import ruCatalog from "./ru/catalog";
import ruApp from "./ru/app";
import ruAdmin from "./ru/admin";
import ruStudio from "./ru/studio";

const uz = {
  common: uzCommon,
  labels: uzLabels,
  landing: uzLanding,
  auth: uzAuth,
  catalog: uzCatalog,
  app: uzApp,
  admin: uzAdmin,
  studio: uzStudio,
};

export type Messages = typeof uz;

const ru: Messages = {
  common: ruCommon,
  labels: ruLabels as Messages["labels"],
  landing: ruLanding,
  auth: ruAuth,
  catalog: ruCatalog,
  app: ruApp,
  admin: ruAdmin,
  studio: ruStudio,
} as Messages;

let oz: Messages | null = null;

export function getMessages(locale: Locale): Messages {
  if (locale === "ru") return ru;
  if (locale === "oz") return (oz ??= translitDeep(uz));
  return uz;
}

/**
 * Server-side subset of the messages for one locale: whole namespaces ("landing") or sub-trees ("app.finance").
 * Layouts send only what their segment renders, so the browser never downloads every language and area.
 */
export function pickMessages(locale: Locale, paths: readonly string[]): PartialMessages {
  const all = getMessages(locale) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.split(".");
    let src: unknown = all;
    let dst = out;
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i]!;
      src = src && typeof src === "object" ? (src as Record<string, unknown>)[k] : undefined;
      if (src === undefined) break;
      if (i === parts.length - 1) dst[k] = src;
      else dst = (dst[k] ??= {}) as Record<string, unknown>;
    }
  }
  return out as PartialMessages;
}

export type PartialMessages = { [K in keyof Messages]?: Partial<Messages[K]> };

/** Namespaces per route segment (see the layouts). */
export const SCOPES = {
  root: ["common", "labels", "catalog", "auth"],
  marketing: ["landing", "app.finance"],
  cabinet: ["app", "studio", "admin.control", "admin.common"],
  admin: ["admin", "app"],
} as const;
