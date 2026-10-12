import type { Metadata } from "next";
import { PurchaseDetailView } from "@/components/cabinet/buyer/PurchaseDetailView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.purchase") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseDetailView id={id} />;
}
