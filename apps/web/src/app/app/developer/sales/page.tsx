import type { Metadata } from "next";
import { SalesView } from "@/components/cabinet/developer/SalesView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.devSales") };
}

export default function Page() {
  return <SalesView />;
}
