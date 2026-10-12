import type { Metadata } from "next";
import { FilesView } from "@/components/cabinet/buyer/FilesView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.files") };
}

export default function Page() {
  return <FilesView />;
}
