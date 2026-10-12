"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft2,
  Call,
  Clock,
  InfoCircle,
  LockCircle,
  Messages2,
  More,
  Profile,
  Refresh,
  Send2,
  TickCircle,
  UserTick,
  Warning2,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { SupportThread } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useFormat } from "../format";
import { TypingDots } from "./ThreadList";
import { dayKey, sameGroup, threadName, threadPhone, type LocalMessage, type ThreadStatus } from "./utils";

export function ThreadStatusBadge({ status }: { status: ThreadStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={status === "OPEN" ? "success" : status === "PENDING" ? "warning" : "neutral"} dot>
      {t(`admin.support.tabs.${status}`)}
    </Badge>
  );
}

export function Conversation({
  thread,
  messages,
  loading,
  error,
  onReload,
  typing,
  readUpTo,
  meId,
  onSend,
  onRetry,
  onTyping,
  onBack,
  onInfo,
  onStatus,
  onAssignMe,
}: {
  thread: SupportThread | null;
  messages: LocalMessage[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  typing: boolean;
  readUpTo: number;
  meId: string;
  onSend: (body: string) => void;
  onRetry: (m: LocalMessage) => void;
  onTyping: () => void;
  onBack: () => void;
  onInfo: () => void;
  onStatus: (s: ThreadStatus) => void;
  onAssignMe: () => void;
}) {
  const { t, tr, raw } = useI18n();
  const f = useFormat();
  const scroller = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const [unseen, setUnseen] = React.useState(0);
  const lastCount = React.useRef(0);
  const lastThread = React.useRef<string | null>(null);

  const scrollToBottom = React.useCallback((smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseen(0);
  }, []);

  // auto-scroll: jump on thread switch, follow when at bottom or when I sent the message
  React.useLayoutEffect(() => {
    const switched = thread?.id !== lastThread.current;
    lastThread.current = thread?.id ?? null;
    const before = lastCount.current;
    const added = messages.length - before;
    lastCount.current = messages.length;
    if (switched || before === 0) {
      requestAnimationFrame(() => scrollToBottom(false));
      return;
    }
    if (added <= 0) return;
    const last = messages[messages.length - 1];
    if (atBottom.current || last?.senderType === "AGENT") requestAnimationFrame(() => scrollToBottom(true));
    else setUnseen((n) => n + added);
  }, [messages, thread?.id, scrollToBottom]);

  React.useEffect(() => {
    if (typing && atBottom.current) requestAnimationFrame(() => scrollToBottom(true));
  }, [typing, scrollToBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom.current) setUnseen(0);
  };

  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        {loading ? (
          <div className="w-full max-w-md space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-12 rounded-2xl", i % 2 ? "ml-auto w-2/3" : "w-3/4")} />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative mb-5 grid size-20 place-items-center rounded-3xl border border-gold-500/20 bg-gold-500/[0.06] text-gold-300"
            >
              <span className="absolute inset-0 animate-pulse-ring rounded-3xl border border-gold-500/20" />
              <Messages2 size={34} variant="Bulk" />
            </motion.div>
            <h3 className="font-display text-2xl text-stone-100">{t("admin.support.select")}</h3>
            <p className="mt-2 max-w-sm text-sm text-ink-400">{t("admin.support.selectHint")}</p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-ink-500">
              <kbd className="rounded border border-line px-1.5 font-mono">↑</kbd>
              <kbd className="rounded border border-line px-1.5 font-mono">↓</kbd>
            </div>
          </>
        )}
      </div>
    );
  }

  const name = threadName(thread, t("admin.support.guest"));
  const phone = threadPhone(thread);
  const closed = thread.status === "CLOSED";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line px-3 py-3 md:px-5">
        <button type="button" onClick={onBack} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-fg/5 hover:text-stone-100 lg:hidden" aria-label={t("common.actions.back")}>
          <ArrowLeft2 size={18} />
        </button>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold", thread.user ? "bg-gold-gradient text-onyx" : "border border-dashed border-line-strong bg-ink-800 text-ink-300")}>
          {thread.user ? initials(name) : <Profile size={18} variant="Bulk" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-stone-100">{tr(name)}</span>
            <ThreadStatusBadge status={thread.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-ink-400">
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-mono transition hover:text-gold-300">
                <Call size={12} /> {phone}
              </a>
            )}
            <span className="hidden truncate sm:inline">
              · {thread.assignedTo ? t("admin.support.assignedTo", { name: thread.assignedTo.id === meId ? t("admin.support.you") : thread.assignedTo.fullName }) : t("admin.support.unassigned")}
            </span>
          </div>
        </div>
        {thread.assignedTo?.id !== meId && (
          <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={onAssignMe}>
            <UserTick /> {t("admin.support.context.assignMe")}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-fg/5 hover:text-stone-100" aria-label={t("admin.support.context.actions")}>
              <More size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {thread.assignedTo?.id !== meId && (
              <DropdownMenuItem onSelect={onAssignMe}>
                <UserTick /> {t("admin.support.context.assignMe")}
              </DropdownMenuItem>
            )}
            {thread.status !== "PENDING" && !closed && (
              <DropdownMenuItem onSelect={() => onStatus("PENDING")}>
                <Clock /> {t("admin.support.context.markPending")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {closed ? (
              <DropdownMenuItem onSelect={() => onStatus("OPEN")}>
                <Refresh /> {t("admin.support.context.reopen")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onStatus("CLOSED")}>
                <LockCircle /> {t("admin.support.context.close")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={onInfo} className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-fg/5 hover:text-stone-100 xl:hidden" aria-label={t("admin.support.context.show")}>
          <InfoCircle size={18} />
        </button>
      </div>

      {/* messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-4 md:px-6" aria-live="polite" aria-relevant="additions">
          {error ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Warning2 size={28} variant="Bulk" className="mx-auto mb-2 text-danger" />
                <div className="text-sm text-stone-100">{t("admin.support.loadThreadError")}</div>
                <div className="mt-1 font-mono text-[11px] text-ink-500">{error}</div>
                <Button size="sm" variant="secondary" className="mt-3" onClick={onReload}>
                  <Refresh /> {t("common.actions.retry")}
                </Button>
              </div>
            </div>
          ) : loading && messages.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={cn("h-11 rounded-2xl", i % 3 === 1 ? "ml-auto w-1/2" : "w-2/3")} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-ink-500">{t("admin.support.noMessages")}</div>
          ) : (
            <MessageList messages={messages} meId={meId} readUpTo={readUpTo} onRetry={onRetry} f={f} />
          )}
          <AnimatePresence>
            {typing && !closed && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mt-3 flex items-end gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-ink-800 px-4 py-3 text-ink-300">
                  <TypingDots />
                </div>
                <span className="mb-1 text-[11px] italic text-ink-500">{t("admin.support.typing")}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {unseen > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-4 left-1/2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-xs font-bold text-onyx shadow-glow"
            >
              <ArrowDown size={14} /> {t("admin.support.newMessages")} · {unseen}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* composer */}
      {closed ? (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line bg-ink-900/60 px-4 py-4 text-sm text-ink-400">
          <LockCircle size={16} /> {t("admin.support.closedNotice")}
          <Button size="sm" variant="secondary" onClick={() => onStatus("OPEN")}>
            <Refresh /> {t("admin.support.context.reopen")}
          </Button>
        </div>
      ) : (
        <Composer key={thread.id} onSend={onSend} onTyping={onTyping} quickReplies={raw<string[]>("admin.support.quickReplies") ?? []} />
      )}
    </div>
  );
}

function MessageList({
  messages,
  meId,
  readUpTo,
  onRetry,
  f,
}: {
  messages: LocalMessage[];
  meId: string;
  readUpTo: number;
  onRetry: (m: LocalMessage) => void;
  f: ReturnType<typeof useFormat>;
}) {
  const { t } = useI18n();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  return (
    <div className="space-y-1">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
        const groupedWithPrev = !newDay && sameGroup(prev, m);
        const groupedWithNext = next && dayKey(next.createdAt) === dayKey(m.createdAt) && sameGroup(m, next);
        const dk = dayKey(m.createdAt);
        const dayLabel = dk === today ? t("admin.support.today") : dk === yesterday ? t("admin.support.yesterday") : f.date(m.createdAt);

        return (
          <React.Fragment key={m.key ?? m.id}>
            {newDay && (
              <div className="sticky top-0 z-10 flex justify-center py-3">
                <span className="rounded-full border border-line bg-ink-900/90 px-3 py-1 text-[11px] font-medium text-ink-300 backdrop-blur">{dayLabel}</span>
              </div>
            )}
            {m.senderType === "SYSTEM" ? (
              <div className="flex justify-center py-2">
                <span className="max-w-md rounded-xl bg-fg/[0.04] px-3 py-1.5 text-center text-xs italic text-ink-400">{m.body}</span>
              </div>
            ) : (
              <Bubble
                m={m}
                mine={m.senderType === "AGENT"}
                ownAgent={m.senderType === "AGENT" && (!m.sender || m.sender.id === meId)}
                first={!groupedWithPrev}
                last={!groupedWithNext}
                read={m.senderType === "AGENT" && !m.local && new Date(m.createdAt).getTime() <= readUpTo}
                onRetry={() => onRetry(m)}
                time={f.time(m.createdAt)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Bubble({
  m,
  mine,
  ownAgent,
  first,
  last,
  read,
  onRetry,
  time,
}: {
  m: LocalMessage;
  mine: boolean;
  ownAgent: boolean;
  first: boolean;
  last: boolean;
  read: boolean;
  onRetry: () => void;
  time: string;
}) {
  const { t } = useI18n();
  const failed = m.local === "failed";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", first && "mt-3")}
    >
      {!mine && (
        <span className={cn("mb-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-ink-800 text-[10px] font-bold text-ink-300", !last && "invisible")}>
          {m.sender ? initials(m.sender.fullName) : <Profile size={14} />}
        </span>
      )}
      <div className={cn("flex max-w-[82%] flex-col md:max-w-[68%]", mine ? "items-end" : "items-start")}>
        {first && mine && !ownAgent && m.sender && <span className="mb-1 px-1 text-[10px] font-medium text-gold-300/80">{m.sender.fullName}</span>}
        <div
          className={cn(
            "whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            mine
              ? cn("rounded-2xl rounded-br-md border border-gold-500/25 bg-gold-500/[0.13] text-stone-100", !first && "rounded-tr-md")
              : cn("rounded-2xl rounded-bl-md border border-line bg-ink-800 text-ink-100", !first && "rounded-tl-md"),
            m.local === "sending" && "opacity-70",
            failed && "border-danger/40 bg-danger/[0.08]",
          )}
        >
          {m.body}
        </div>
        {last && (
          <div className={cn("mt-1 flex items-center gap-1.5 px-1 text-[10px]", failed ? "text-danger" : "text-ink-500")}>
            {failed ? (
              <button type="button" onClick={onRetry} className="inline-flex cursor-pointer items-center gap-1 font-semibold hover:underline">
                <Warning2 size={12} variant="Bold" /> {t("admin.support.failed")} · {t("admin.support.retry")}
              </button>
            ) : (
              <>
                <span>{time}</span>
                {mine &&
                  (m.local === "sending" ? (
                    <Clock size={11} aria-label={t("admin.support.sending")} />
                  ) : (
                    <span className={cn("inline-flex", read ? "text-gold-300" : "text-ink-500")} aria-label={read ? t("admin.support.read") : undefined}>
                      <TickCircle size={11} variant={read ? "Bold" : "Linear"} />
                    </span>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Composer({ onSend, onTyping, quickReplies }: { onSend: (body: string) => void; onTyping: () => void; quickReplies: string[] }) {
  const { t } = useI18n();
  const [text, setText] = React.useState("");
  const area = React.useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };
  React.useLayoutEffect(resize, [text]);
  React.useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) area.current?.focus();
  }, []);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
    area.current?.focus();
  };

  return (
    <div className="border-t border-line bg-ink-900/60 px-3 pb-3 pt-2.5 md:px-5 md:pb-4">
      <div className="no-scrollbar mask-fade-x -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1">
        {quickReplies.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setText((cur) => (cur ? `${cur.trimEnd()} ${q}` : q));
              area.current?.focus();
            }}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-line bg-ink-850 px-3 py-1 text-xs text-ink-300 transition hover:-translate-y-px hover:border-gold-500/40 hover:text-gold-200 active:scale-95"
            title={q}
          >
            {q.length > 42 ? `${q.slice(0, 40)}…` : q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-2xl border border-line bg-ink-850 p-1.5 pl-4 transition focus-within:border-gold-500/50 focus-within:ring-4 focus-within:ring-gold-500/10"
      >
        <textarea
          ref={area}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("admin.support.placeholder")}
          aria-label={t("admin.support.placeholder")}
          className="max-h-42 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-sm leading-5 text-stone-100 placeholder:text-ink-500 focus:outline-none"
        />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.92 }}
          disabled={!text.trim()}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          aria-label={t("admin.support.send")}
        >
          <Send2 size={18} variant="Bold" />
        </motion.button>
      </form>
      <div className="mt-1.5 hidden px-1 text-[10px] text-ink-500 md:block">{t("admin.support.hint")}</div>
    </div>
  );
}
