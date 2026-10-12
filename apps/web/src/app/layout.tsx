import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import { getLocale, getScopeMessages } from "@/i18n/server";
import { LOCALE_META } from "@/i18n/config";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ekabuild.uz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "EKA BUILD — Ishonchli qurilish platformasi", template: "%s · EKA BUILD" },
  description:
    "Qurilish obyektlarini sotib olishdan oldin ruxsatnoma, sertifikat, kadastr va qurilish jarayonini tekshiring. 3D modellar, chizmalar, E-IMZO bilan shartnoma.",
  applicationName: "EKA BUILD",
  openGraph: { type: "website", siteName: "EKA BUILD", images: ["/brand/signage.jpg"] },
  icons: { icon: "/icon.svg", apple: "/brand/mark.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getScopeMessages("root")]);
  return (
    <html lang={LOCALE_META[locale].htmlLang} data-theme="dark" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
