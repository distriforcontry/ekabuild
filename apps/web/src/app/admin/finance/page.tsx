import { Suspense } from "react";
import { FinanceView } from "@/components/control/FinanceView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.finance");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <FinanceView area="admin" />
    </Suspense>
  );
}
