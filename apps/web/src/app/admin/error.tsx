"use client";
import * as React from "react";
import { Danger, Refresh } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/** Keeps the admin shell alive when a page throws (e.g. an unexpected API shape). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl border border-danger/25 bg-danger/10 text-danger">
          <Danger size={30} variant="Bulk" />
        </div>
        <h1 className="font-display text-3xl text-stone-100">{t("admin.crash.title")}</h1>
        <p className="mt-2 text-sm text-ink-300">{t("admin.crash.description")}</p>
        {error.digest && <p className="mt-3 font-mono text-[11px] text-ink-500">{error.digest}</p>}
        <Button variant="gold" className="mt-6" onClick={reset}>
          <Refresh /> {t("common.actions.retry")}
        </Button>
      </div>
    </div>
  );
}
