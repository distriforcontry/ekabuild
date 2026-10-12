import type { Metadata } from "next";
import { CadastreView } from "@/components/cabinet/inspector/CadastreView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.cadastre") };
}

export default function Page() {
  return <CadastreView />;
}
