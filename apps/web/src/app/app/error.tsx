"use client";
import { useEffect } from "react";
import { Danger, Refresh } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";

export default function CabinetError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon={Danger}
      title={t("app.states.pageError")}
      description={t("app.states.errorHint")}
      action={
        <Button variant="secondary" onClick={reset}>
          <Refresh size={16} /> {t("common.actions.retry")}
        </Button>
      }
    />
  );
}
