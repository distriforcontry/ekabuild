import { Suspense } from "react";
import { RulesView } from "@/components/admin/RulesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.rules");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <RulesView />
    </Suspense>
  );
}
