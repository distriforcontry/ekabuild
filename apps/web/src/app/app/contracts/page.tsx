import type { Metadata } from "next";
import { ContractsView } from "@/components/cabinet/buyer/ContractsView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.contracts") };
}

export default function Page() {
  return <ContractsView />;
}
