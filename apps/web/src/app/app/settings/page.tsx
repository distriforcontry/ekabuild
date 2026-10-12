import type { Metadata } from "next";
import { SettingsView } from "@/components/cabinet/buyer/SettingsView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.settings") };
}

export default function Page() {
  return <SettingsView />;
}
