import { Suspense } from "react";
import { CertificatesView } from "@/components/admin/CertificatesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.certificates");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <CertificatesView />
    </Suspense>
  );
}
