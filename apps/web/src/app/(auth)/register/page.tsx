import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.meta.register") };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
