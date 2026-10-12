"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, CloudCross, Refresh } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Friendly "API is unreachable" card with a retry (router.refresh) button. */
export function ErrorCard({
  title,
  hint,
  backHref,
  backLabel,
  className,
}: {
  title?: string;
  hint?: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-line bg-ink-900 px-6 py-16 text-center shadow-card md:py-20",
        className,
      )}
      role="alert"
    >
      <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-danger/25 bg-danger/8 text-danger">
          <CloudCross size={28} variant="Bulk" />
        </div>
        <h2 className="font-display text-3xl text-stone-100">{title ?? t("catalog.error.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{hint ?? t("catalog.error.hint")}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button variant="gold" loading={pending} onClick={() => start(() => router.refresh())}>
            {!pending && <Refresh size={16} />}
            {t("catalog.error.retry")}
          </Button>
          {backHref && (
            <Button variant="secondary" asChild>
              <Link href={backHref}>
                <ArrowLeft size={16} />
                {backLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
