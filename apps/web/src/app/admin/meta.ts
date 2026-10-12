import "server-only";
import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/core";

/** Translated <title> for an admin page: export const generateMetadata = adminMeta("admin.nav.users") */
export function adminMeta(key: MessageKey) {
  return async (): Promise<Metadata> => {
    const { t } = await getI18n();
    return { title: t(key) };
  };
}
