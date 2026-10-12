import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.meta.forgot"), robots: { index: false } };
}

export default function ForgotPage() {
  return <ForgotForm />;
}
