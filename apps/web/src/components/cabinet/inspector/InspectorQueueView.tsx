"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardTick, TaskSquare } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { PageHead } from "../kit";
import { ErrorState } from "../states";
import { InspectorQueue, useInspectorQueue, type QueueTab } from "./InspectorQueue";

/** Full-page verification queue (/app/inspector/queue). */
export function InspectorQueueView() {
  const { t } = useI18n();
  const queue = useInspectorQueue();
  const params = useSearchParams();
  const initial: QueueTab = params.get("tab") === "documents" ? "documents" : "certificates";
  const total = (queue.data?.certificates.length ?? 0) + (queue.data?.documents.length ?? 0);
  return (
    <div>
      <PageHead
        eyebrow={t("app.shell.sections.inspector")}
        icon={TaskSquare}
        title={t("app.inspector.queue.title")}
        description={t("app.inspector.queue.subtitle")}
        meta={
          !queue.loading && !queue.error ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-200">
              <span className="size-1.5 rounded-full bg-gold-400" /> {t("app.inspector.queue.pending", { n: total })}
            </span>
          ) : undefined
        }
        actions={
          <Button asChild variant="gold">
            <Link href="/app/inspector/inspections/new">
              <ClipboardTick size={18} variant="Bold" /> {t("app.shell.nav.inspNew")}
            </Link>
          </Button>
        }
      />
      {queue.error ? <ErrorState error={queue.error} onRetry={queue.reload} /> : <InspectorQueue state={queue} initialTab={initial} />}
    </div>
  );
}
