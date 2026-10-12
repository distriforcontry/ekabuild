"use client";
import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { PartialMessages } from "@/i18n/messages";

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

export function Providers({ locale, messages, children }: { locale: Locale; messages: PartialMessages; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" themes={["dark", "light"]} enableSystem disableTransitionOnChange={false}>
      <I18nProvider locale={locale} messages={messages}>
        {children}
        <ThemedToaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
