import { Suspense } from "react";
import { UsersView } from "@/components/admin/UsersView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.users");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <UsersView />
    </Suspense>
  );
}
