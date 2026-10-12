import type { Locale } from "../config";
import { translitDeep } from "../translit";

import uzCommon from "./uz/common";
import uzLabels from "./uz/labels";
import uzLanding from "./uz/landing";
import uzAuth from "./uz/auth";
import uzCatalog from "./uz/catalog";
import uzApp from "./uz/app";
import uzAdmin from "./uz/admin";

import ruCommon from "./ru/common";
import ruLabels from "./ru/labels";
import ruLanding from "./ru/landing";
import ruAuth from "./ru/auth";
import ruCatalog from "./ru/catalog";
import ruApp from "./ru/app";
import ruAdmin from "./ru/admin";

const uz = {
  common: uzCommon,
  labels: uzLabels,
  landing: uzLanding,
  auth: uzAuth,
  catalog: uzCatalog,
  app: uzApp,
  admin: uzAdmin,
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
} as Messages;

let oz: Messages | null = null;

export function getMessages(locale: Locale): Messages {
  if (locale === "ru") return ru;
  if (locale === "oz") return (oz ??= translitDeep(uz));
  return uz;
}
