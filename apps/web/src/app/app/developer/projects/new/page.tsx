import type { Metadata } from "next";
import { ProjectEditor } from "@/components/cabinet/developer/ProjectEditor";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.devProjectNew") };
}

export default function Page() {
  return <ProjectEditor id={null} />;
}
