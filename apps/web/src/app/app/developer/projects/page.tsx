import type { Metadata } from "next";
import { DevProjectsView } from "@/components/cabinet/developer/DevProjectsView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.devProjects") };
}

export default function Page() {
  return <DevProjectsView />;
}
