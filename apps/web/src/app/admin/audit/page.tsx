import { Suspense } from "react";
import { AuditView } from "@/components/admin/AuditView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.audit");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <AuditView />
    </Suspense>
  );
}
