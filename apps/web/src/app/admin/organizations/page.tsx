import { Suspense } from "react";
import { OrganizationsView } from "@/components/admin/OrganizationsView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.organizations");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <OrganizationsView />
    </Suspense>
  );
}
