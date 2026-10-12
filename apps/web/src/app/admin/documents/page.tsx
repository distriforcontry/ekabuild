import { Suspense } from "react";
import { DocumentsView } from "@/components/admin/DocumentsView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.documents");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <DocumentsView />
    </Suspense>
  );
}
