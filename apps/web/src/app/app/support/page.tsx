import type { Metadata } from "next";
import { SupportChat } from "@/components/cabinet/buyer/SupportChat";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.support") };
}

export default function Page() {
  return <SupportChat />;
}
