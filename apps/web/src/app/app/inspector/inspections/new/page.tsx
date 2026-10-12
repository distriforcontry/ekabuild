import type { Metadata } from "next";
import { NewInspectionView } from "@/components/cabinet/inspector/NewInspectionView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.inspectionNew") };
}

export default function Page() {
  return <NewInspectionView />;
}
