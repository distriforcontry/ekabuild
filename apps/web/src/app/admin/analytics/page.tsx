import { Suspense } from "react";
import { AnalyticsView } from "@/components/admin/analytics/AnalyticsView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.analytics");

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <AnalyticsView />
    </Suspense>
  );
}
