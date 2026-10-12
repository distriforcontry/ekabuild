import type { Metadata } from "next";
import { DevDashboardView } from "@/components/cabinet/developer/DevDashboardView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.developer") };
}

export default function Page() {
  return <DevDashboardView />;
}
