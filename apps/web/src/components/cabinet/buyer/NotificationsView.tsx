"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight2, Danger, InfoCircle, Notification, TickCircle, Warning2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNotifications } from "../CabinetContext";
import { dayKey, useFmt } from "../format";
import { NOTIF_TONE } from "../NotificationsBell";
import { ErrorState, ListSkeleton } from "../states";
import { PageHead, PanelEmpty as EmptyState } from "../kit";

const ICONS: Record<NotificationItem["type"], IconType> = { INFO: InfoCircle, SUCCESS: TickCircle, WARNING: Warning2, DANGER: Danger };

export function NotificationsView() {
  const { t } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { items, unread, loading, error, reload, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const list = filter === "unread" ? items.filter((n) => !n.readAt) : items;
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const dayLabel = (d: string) => (dayKey(d) === today ? t("app.common.today") : dayKey(d) === yesterday ? t("app.common.yesterday") : fmt.date(d));

  return (
    <div>
      <PageHead icon={Notification}
        eyebrow={t("app.shell.area")}
        title={t("app.notifications.title")}
        description={t("app.notifications.subtitle")}
        actions={
          unread > 0 && (
            <Button variant="secondary" onClick={() => void markAllRead()}>
              <TickCircle size={18} /> {t("app.notifications.markAll")}
            </Button>
          )
        }
      />

      <div className="mb-6 inline-flex rounded-xl border border-line bg-ink-900 p-1" role="tablist">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium transition",
              filter === f ? "text-stone-100" : "text-ink-300 hover:text-stone-100",
            )}
          >
            {filter === f && <motion.span layoutId="notif-filter" className="absolute inset-0 rounded-lg bg-ink-700 shadow-card" />}
            <span className="relative">{t(`app.notifications.filters.${f}`)}</span>
            {f === "unread" && unread > 0 && <span className="relative rounded-full bg-gold-500 px-1.5 font-mono text-[10px] font-bold text-onyx">{unread}</span>}
          </button>
        ))}
      </div>

      {loading && !items.length ? (
        <ListSkeleton rows={5} />
      ) : error && !items.length ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Notification}
          title={filter === "unread" ? t("app.notifications.emptyUnread") : t("app.notifications.empty")}
          description={t("app.notifications.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((n, i) => {
              const tone = NOTIF_TONE[n.type] ?? NOTIF_TONE.INFO;
              const Icon = ICONS[n.type] ?? InfoCircle;
              const showDay = i === 0 || dayKey(list[i - 1]!.createdAt) !== dayKey(n.createdAt);
              return (
                <motion.li key={n.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  {showDay && <div className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400 first:mt-0">{dayLabel(n.createdAt)}</div>}
                  <div
                    className={cn(
                      "group relative flex gap-4 overflow-hidden rounded-2xl border p-4 transition md:p-5",
                      n.readAt ? "border-line bg-ink-900/60" : "border-line-strong bg-ink-900 shadow-card",
                    )}
                  >
                    {!n.readAt && <span className={cn("absolute inset-y-0 left-0 w-1", tone.dot)} />}
                    <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl border", tone.ring, tone.text)}>
                      <Icon size={20} variant="Bulk" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", tone.text)}>{t(`app.notifications.types.${n.type}`)}</span>
                        <span className="text-[11px] text-ink-500">· {fmt.relative(n.createdAt)}</span>
                      </div>
                      <div className={cn("mt-1 text-sm md:text-[15px]", n.readAt ? "text-ink-200" : "font-semibold text-stone-100")}>{n.title}</div>
                      {n.body && <p className="mt-1 text-sm leading-relaxed text-ink-400">{n.body}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.link && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              void markRead(n.id);
                              router.push(n.link!);
                            }}
                          >
                            {t("app.notifications.open")} <ArrowRight2 size={14} />
                          </Button>
                        )}
                        {!n.readAt && (
                          <Button size="sm" variant="ghost" onClick={() => void markRead(n.id)}>
                            <TickCircle size={14} /> {t("app.notifications.markRead")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
