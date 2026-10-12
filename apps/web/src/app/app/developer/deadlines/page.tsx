import { Suspense } from "react";
import type { Metadata } from "next";
import { DeadlinesView } from "@/components/control/DeadlinesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.finance.nav.deadlines") };
}

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <DeadlinesView area="dev" />
    </Suspense>
  );
}
