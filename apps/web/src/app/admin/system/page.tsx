import { SystemView } from "@/components/admin/system/SystemView";
import { adminMeta } from "../meta";

export const generateMetadata = adminMeta("admin.nav.systemMap");

export default function SystemMapPage() {
  return <SystemView />;
}
