import type { Metadata } from "next";
import { UserActivityView } from "@/components/admin/UserActivityView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.control.activity.eyebrow") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserActivityView key={id} id={id} />;
}
