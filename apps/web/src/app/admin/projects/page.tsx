import { Suspense } from "react";
import { ProjectsView } from "@/components/admin/ProjectsView";
import { ListFallback } from "@/components/admin/ListFallback";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.projects");

export default function Page() {
  return (
    <Suspense fallback={<ListFallback />}>
      <ProjectsView />
    </Suspense>
  );
}
