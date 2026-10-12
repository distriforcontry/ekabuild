import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api-server";
import { isAdmin } from "@/lib/roles";

/** Inspector area: INSPECTOR (or admins) only. */
export default async function InspectorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/inspector");
  if (user.role !== "INSPECTOR" && !isAdmin(user.role)) redirect("/app");
  return <>{children}</>;
}
