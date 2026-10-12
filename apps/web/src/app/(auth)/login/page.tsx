import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { getI18n } from "@/i18n/server";
import { staticSearchParams } from "@/lib/static";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.meta.login"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await staticSearchParams(searchParams);
  const next = typeof sp.next === "string" ? sp.next : null;
  return <LoginForm next={next} />;
}
