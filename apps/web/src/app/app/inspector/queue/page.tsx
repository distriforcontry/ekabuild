import type { Metadata } from "next";
import { Suspense } from "react";
import { InspectorQueueView } from "@/components/cabinet/inspector/InspectorQueueView";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.meta.inspQueue") };
}

export default function Page() {
  return (
    <Suspense>
      <InspectorQueueView />
    </Suspense>
  );
}
