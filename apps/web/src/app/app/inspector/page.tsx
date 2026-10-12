import type { Metadata } from "next";
import { InspectorDashboardView } from "@/components/cabinet/inspector/InspectorDashboardView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.inspector") };
}

export default function Page() {
  return <InspectorDashboardView />;
}
