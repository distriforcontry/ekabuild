import type { Metadata } from "next";
import { FeedView } from "@/components/cabinet/buyer/FeedView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.feed") };
}

export default function Page() {
  return <FeedView />;
}
