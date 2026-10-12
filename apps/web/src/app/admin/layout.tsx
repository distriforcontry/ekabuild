import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/api-server";
import { homeForRole, isAdmin } from "@/lib/roles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t("admin.area"), template: `%s · ${t("admin.area")} · EKA BUILD` },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user.role)) redirect(homeForRole(user.role));

  const jar = await cookies();
  const defaultCollapsed = jar.get("eka_sidebar")?.value === "1";
  const { t } = await getI18n();

  return (
    <AdminShell
      area={t("admin.area")}
      defaultCollapsed={defaultCollapsed}
      user={{
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        organization: user.organization ? { name: user.organization.name } : null,
      }}
    >
      {children}
    </AdminShell>
  );
}
