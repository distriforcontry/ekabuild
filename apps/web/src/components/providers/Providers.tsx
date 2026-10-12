"use client";
import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "dark" | "light") ?? "dark"}
      position="top-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "!rounded-xl !border-line !font-sans" } }}
    />
  );
}

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" themes={["dark", "light"]} enableSystem disableTransitionOnChange={false}>
      <I18nProvider locale={locale}>
        {children}
        <ThemedToaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
