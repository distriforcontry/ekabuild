"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight2, Notification, TickCircle } from "iconsax-reactjs";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNotifications } from "./CabinetContext";
import { useFmt } from "./format";

export const NOTIF_TONE: Record<NotificationItem["type"], { dot: string; ring: string; text: string }> = {
  INFO: { dot: "bg-info", ring: "border-info/30 bg-info/10", text: "text-info" },
  SUCCESS: { dot: "bg-success", ring: "border-success/30 bg-success/10", text: "text-success" },
  WARNING: { dot: "bg-warning", ring: "border-warning/30 bg-warning/10", text: "text-warning" },
  DANGER: { dot: "bg-danger", ring: "border-danger/30 bg-danger/10", text: "text-danger" },
};

/** Top-bar bell: unread counter + dropdown with the latest notifications. */
export function NotificationsBell() {
  const { t } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { items, unread, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const latest = items.slice(0, 6);

  const openItem = (n: NotificationItem) => {
    void markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread ? `${t("app.notifications.bell")} — ${t("app.notifications.unread", { n: unread })}` : t("app.notifications.bell")}
          className="relative grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-ink-200 transition hover:border-line-strong hover:bg-fg/5 hover:text-stone-100 data-[state=open]:border-gold-500/50 data-[state=open]:text-gold-300"
        >
          <Notification size={19} variant={unread ? "Bulk" : "Linear"} className={cn(unread > 0 && "text-gold-300")} />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold-gradient px-1 font-mono text-[10px] font-bold text-onyx ring-2 ring-ink-950"
              >
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-gold-400/40" aria-hidden />
                <span className="relative">{unread > 99 ? "99+" : unread}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line-strong bg-ink-850/95 shadow-lift backdrop-blur-xl data-[state=open]:animate-[popIn_.18s_ease-out]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-stone-100">{t("app.notifications.title")}</div>
              {unread > 0 && <div className="text-xs text-ink-400">{t("app.notifications.unread", { n: unread })}</div>}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gold-300 transition hover:bg-gold-500/10"
              >
                <TickCircle size={14} /> {t("app.notifications.markAll")}
              </button>
            )}
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
            {loading && !items.length ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-2.5 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : latest.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-3 grid size-12 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/5 text-gold-300">
                  <Notification size={22} variant="Bulk" />
                </span>
                <div className="text-sm font-semibold text-stone-100">{t("app.notifications.empty")}</div>
                <div className="mt-1 text-xs text-ink-400">{t("app.notifications.emptyHint")}</div>
              </div>
            ) : (
              <ul>
                {latest.map((n) => {
                  const tone = NOTIF_TONE[n.type] ?? NOTIF_TONE.INFO;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          "flex w-full cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-fg/5",
                          !n.readAt && "bg-gold-500/[0.04]",
                        )}
                      >
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot, n.readAt && "opacity-30")} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", n.readAt ? "text-ink-200" : "font-semibold text-stone-100")}>{n.title}</span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-400">{n.body}</span>}
                          <span className="mt-1 block text-[11px] text-ink-500">{fmt.relative(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-line px-4 py-3 text-xs font-semibold text-ink-200 transition hover:bg-fg/5 hover:text-stone-100"
          >
            {t("app.notifications.viewAll")} <ArrowRight2 size={14} />
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
