import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/cabinet/buyer/DashboardView";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.dashboard") };
}

// Developers and inspectors have their own home; the buyer dashboard is for buyers (and admins visiting the cabinet).
export default async function Page() {
  const user = await getCurrentUser();
  if (user?.role === "DEVELOPER") redirect("/app/developer");
  if (user?.role === "INSPECTOR") redirect("/app/inspector");
  return <DashboardView />;
}
