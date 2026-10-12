import { Suspense } from "react";
import { TemplatesView } from "@/components/admin/TemplatesView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.templates");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <TemplatesView />
    </Suspense>
  );
}
