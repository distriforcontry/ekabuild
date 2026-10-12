import type { Metadata } from "next";
import { FavoritesView } from "@/components/cabinet/buyer/FavoritesView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.favorites") };
}

export default function Page() {
  return <FavoritesView />;
}
