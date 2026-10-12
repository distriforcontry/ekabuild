"use client";
import * as React from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { MessageText1, Profile, SearchNormal1, CloseCircle } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { SupportThread } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useFormat } from "../format";
import { useNow } from "../hooks";
import { STATUSES, threadName, type ThreadStatus } from "./utils";

export function ThreadList({
  threads,
  status,
  onStatus,
  counts,
  query,
  onQuery,
  activeId,
  onOpen,
  typing,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  meId,
}: {
  threads: SupportThread[];
  status: ThreadStatus;
  onStatus: (s: ThreadStatus) => void;
  counts: Partial<Record<ThreadStatus, number>>;
  query: string;
  onQuery: (q: string) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  typing: Record<string, boolean>;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  meId: string;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const now = useNow(30_000);
  const [text, setText] = React.useState(query);
  React.useEffect(() => setText(query), [query]);
  React.useEffect(() => {
    if (text === query) return;
    const id = setTimeout(() => onQuery(text.trim()), 320);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const listRef = React.useRef<HTMLUListElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = threads.findIndex((x) => x.id === activeId);
    const next = threads[e.key === "ArrowDown" ? Math.min(threads.length - 1, i + 1) : Math.max(0, i - 1)];
    if (next) {
      onOpen(next.id);
      listRef.current?.querySelector<HTMLElement>(`[data-thread="${next.id}"]`)?.focus();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* status tabs */}
      <div className="border-b border-line p-3">
        <div role="tablist" aria-label={t("admin.common.status")} className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink-850 p-1">
          {STATUSES.map((s) => {
            const active = s === status;
            const n = counts[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatus(s)}
                className={cn("relative flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition", active ? "text-stone-100" : "text-ink-400 hover:text-stone-100")}
              >
                {active && <motion.span layoutId="support-tab" className="absolute inset-0 rounded-lg bg-ink-700 shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{t(`admin.support.tabs.${s}`)}</span>
                {n != null && n > 0 && (
                  <span className={cn("relative rounded-full px-1.5 font-mono text-[10px]", s === "OPEN" ? "bg-gold-500/20 text-gold-200" : "bg-fg/8 text-ink-300")}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative mt-3">
          <SearchNormal1 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("admin.support.search")}
            aria-label={t("admin.support.search")}
            className="h-9 w-full rounded-xl border border-line bg-ink-850 pl-9 pr-8 text-sm text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button type="button" onClick={() => (setText(""), onQuery(""))} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-ink-400 hover:text-stone-100" aria-label={t("common.actions.reset")}>
              <CloseCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {/* threads */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && threads.length === 0 ? (
          <ul className="space-y-1 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <li key={i} className="flex gap-3 rounded-xl p-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : threads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 grid size-14 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/5 text-gold-300">
              <MessageText1 size={24} variant="Bulk" />
            </div>
            <div className="font-semibold text-stone-100">{t("admin.support.empty")}</div>
            <p className="mt-1 max-w-56 text-xs text-ink-400">{t("admin.support.emptyHint")}</p>
          </div>
        ) : (
          <LayoutGroup>
            <ul ref={listRef} className="space-y-0.5 p-2" onKeyDown={onKeyDown} role="listbox" aria-label={t("admin.support.title")}>
              <AnimatePresence initial={false}>
                {threads.map((th) => (
                  <motion.li
                    key={th.id}
                    layout="position"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  >
                    <ThreadRow thread={th} active={th.id === activeId} typing={Boolean(typing[th.id])} onOpen={() => onOpen(th.id)} now={now} f={f} meId={meId} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {hasMore && (
              <div className="px-3 pb-4">
                <Button variant="ghost" size="sm" className="w-full" onClick={onLoadMore} loading={loadingMore}>
                  {t("admin.support.loadMore")}
                </Button>
              </div>
            )}
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  typing,
  onOpen,
  now,
  f,
  meId,
}: {
  thread: SupportThread;
  active: boolean;
  typing: boolean;
  onOpen: () => void;
  now: number;
  f: ReturnType<typeof useFormat>;
  meId: string;
}) {
  const { t, tr } = useI18n();
  const name = threadName(thread, t("admin.support.guest"));
  const guest = !thread.user;
  const unread = thread.unreadForAgent > 0 && !active;
  const last = thread.lastMessage;
  const mine = thread.assignedTo?.id === meId;

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-thread={thread.id}
      onClick={onOpen}
      className={cn(
        "group relative flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-2",
        active ? "bg-gold-500/[0.09] ring-1 ring-gold-500/25" : "hover:bg-fg/[0.04]",
      )}
    >
      {unread && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-400" aria-hidden />}
      <span className="relative shrink-0">
        <span
          className={cn(
            "grid size-10 place-items-center overflow-hidden rounded-xl text-xs font-bold",
            guest ? "border border-dashed border-line-strong bg-ink-800 text-ink-300" : "bg-gold-gradient text-onyx",
          )}
        >
          {guest ? <Profile size={18} variant="Bulk" /> : initials(name)}
        </span>
        {thread.status === "OPEN" && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink-900 bg-success" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-bold text-stone-100" : "font-medium text-ink-100")}>{tr(name)}</span>
          <span className={cn("shrink-0 text-[11px]", unread ? "font-semibold text-gold-300" : "text-ink-500")}>{f.ago(thread.lastMessageAt, now)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs">
            {typing ? (
              <span className="inline-flex items-center gap-1 italic text-gold-300">
                <TypingDots /> {t("admin.support.typing")}
              </span>
            ) : last ? (
              <span className={cn(unread ? "text-ink-200" : "text-ink-400", last.senderType === "SYSTEM" && "italic")}>
                {last.senderType === "AGENT" && <span className="text-ink-500">{t("admin.support.you")}: </span>}
                {last.body}
              </span>
            ) : (
              <span className="text-ink-500">{thread.subject ?? "—"}</span>
            )}
          </span>
          <AnimatePresence>
            {unread && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1.5 font-mono text-[10px] font-bold text-onyx"
              >
                {thread.unreadForAgent > 99 ? "99+" : thread.unreadForAgent}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        {(thread.assignedTo || guest) && (
          <span className="mt-1.5 flex items-center gap-1.5">
            {guest && <span className="rounded-md border border-line px-1.5 py-px text-[10px] text-ink-400">{t("admin.support.guest")}</span>}
            {thread.assignedTo && (
              <span className={cn("truncate rounded-md px-1.5 py-px text-[10px]", mine ? "bg-gold-500/10 text-gold-200" : "bg-fg/5 text-ink-400")}>
                {mine ? t("admin.support.you") : thread.assignedTo.fullName}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-current"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
