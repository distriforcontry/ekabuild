import { Suspense } from "react";
import type { Metadata } from "next";
import { FinanceView } from "@/components/control/FinanceView";
import { ListFallback } from "@/components/admin/ListFallback";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("app.finance.nav.finance") };
}

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <FinanceView area="dev" />
    </Suspense>
  );
}
