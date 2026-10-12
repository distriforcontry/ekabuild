import { Suspense } from "react";
import { SupportInbox } from "@/components/admin/support/SupportInbox";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.support");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <SupportInbox />
    </Suspense>
  );
}
