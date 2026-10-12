import type { Metadata } from "next";
import { DashboardView } from "@/components/cabinet/buyer/DashboardView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.dashboard") };
}

export default function Page() {
  return <DashboardView />;
}
