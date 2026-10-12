import type { Metadata } from "next";
import { PurchasesView } from "@/components/cabinet/buyer/PurchasesView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.purchases") };
}

export default function Page() {
  return <PurchasesView />;
}
