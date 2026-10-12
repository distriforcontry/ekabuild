import { getCurrentUser, homeForRole } from "@/lib/api-server";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { SupportWidget } from "@/components/support/SupportWidget";
import { Splash } from "@/components/brand/Splash";

// Public marketing shell: splash (first visit per session), sticky glass header, footer and the support chat.
// The header is fixed; the spacer below keeps content clear of it, and hero sections pull themselves
// up underneath it with -mt-20 so the transparent header floats over their backdrop.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const headerUser = user ? { name: user.fullName, home: homeForRole(user.role) } : null;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Splash />
      <MarketingHeader user={headerUser} />
      <div aria-hidden className="h-20 shrink-0" />
      <main id="main" className="relative flex-1">
        {children}
      </main>
      <Footer />
      <SupportWidget user={user ? { name: user.fullName } : null} />
    </div>
  );
}
