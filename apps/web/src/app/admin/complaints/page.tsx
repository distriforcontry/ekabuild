import { Suspense } from "react";
import { ComplaintsView } from "@/components/admin/ComplaintsView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.complaints");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <ComplaintsView />
    </Suspense>
  );
}
