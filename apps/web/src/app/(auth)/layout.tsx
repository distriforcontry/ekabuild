import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { getCurrentUser } from "@/lib/api-server";
import { homeForRole } from "@/lib/roles";

// Auth screens: already signed-in visitors go straight to their home area.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  return <AuthFrame>{children}</AuthFrame>;
}
