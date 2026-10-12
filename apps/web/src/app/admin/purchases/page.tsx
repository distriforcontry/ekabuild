import { Suspense } from "react";
import { PurchasesView } from "@/components/admin/PurchasesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.purchases");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <PurchasesView />
    </Suspense>
  );
}
