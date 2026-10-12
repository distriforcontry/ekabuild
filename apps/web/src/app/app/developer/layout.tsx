import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api-server";
import { isAdmin } from "@/lib/roles";

/** Developer area: DEVELOPER (or admins) only. */
export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/developer");
  if (user.role !== "DEVELOPER" && !isAdmin(user.role)) redirect("/app");
  return <>{children}</>;
}
