import type { Metadata } from "next";
import { ContractDetailView } from "@/components/cabinet/buyer/ContractDetailView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.contract") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractDetailView id={id} />;
}
