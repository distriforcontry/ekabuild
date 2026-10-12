import type { Metadata } from "next";
import { NotificationsView } from "@/components/cabinet/buyer/NotificationsView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.notifications") };
}

export default function Page() {
  return <NotificationsView />;
}
