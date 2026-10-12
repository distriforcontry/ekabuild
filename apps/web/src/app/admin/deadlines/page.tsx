import { Suspense } from "react";
import { DeadlinesView } from "@/components/control/DeadlinesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.deadlines");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <DeadlinesView area="admin" />
    </Suspense>
  );
}
