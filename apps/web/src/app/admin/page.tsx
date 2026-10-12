import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { adminMeta } from "./meta";

export const generateMetadata = adminMeta("admin.nav.dashboard");

export default function AdminHomePage() {
  return <AdminDashboard />;
}
