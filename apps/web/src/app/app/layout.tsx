import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { getCurrentUser } from "@/lib/api-server";
import { I18nScope } from "@/i18n/client";
import { getScopeMessages } from "@/i18n/server";

// Logged-in cabinet (/app, app.ekabuild.uz). Middleware already bounces visitors without a session;
// here we resolve the user and hand it to the client shell (role-based navigation).
export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const collapsed = (await cookies()).get("eka_sidebar")?.value === "1";
  return (
    <I18nScope messages={await getScopeMessages("cabinet")}>
      <CabinetShell user={user} defaultCollapsed={collapsed}>
        {children}
      </CabinetShell>
    </I18nScope>
  );
}
