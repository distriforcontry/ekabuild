"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Call, CloseCircle, Messages3, Refresh, Send2, Warning2 } from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useSupportSocket, type SupportEvent } from "@/lib/realtime";
import type { SupportMessage, SupportThread } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime } from "@/components/marketing/format";
import {
  SUPPORT_OPEN_EVENT,
  SUPPORT_REFRESH_EVENT,
  normalizeUzPhone,
  readGuestToken,
  writeGuestToken,
} from "./support-utils";

type ChatMessage = SupportMessage & { pending?: boolean; failed?: boolean };
type StartResponse = { thread: SupportThread; messages: SupportMessage[]; guestToken?: string };
type MineResponse = { thread: SupportThread | null; messages: SupportMessage[] };

const HIDDEN_PATHS = [/^\/app\/support(\/|$)/, /^\/admin(\/|$)/];

/**
 * Floating visitor support chat.
 * Guests get a token from POST /support/threads (kept in localStorage) so the thread survives reloads;
 * logged-in users are identified by their session cookie. Live updates come over the support WebSocket,
 * with REST as a fallback whenever the socket is not open.
 */
export function SupportWidget({ user }: { user: { name: string } | null }) {
  const pathname = usePathname() ?? "/";
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();
  const authed = !!user;

  const [open, setOpen] = React.useState(false);
  const [guestToken, setGuestToken] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<SupportThread | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [agentsOnline, setAgentsOnline] = React.useState<number | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const openRef = React.useRef(open);
  openRef.current = open;
  const threadRef = React.useRef(thread);
  threadRef.current = thread;
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const hidden = HIDDEN_PATHS.some((re) => re.test(pathname));

  const guestHeaders = React.useCallback(
    (token: string | null = guestToken): Record<string, string> | undefined => (token ? { "x-guest-token": token } : undefined),
    [guestToken],
  );

  // ── restore an existing thread (session cookie or guest token)
  const restore = React.useCallback(
    async (token: string | null) => {
      if (!authed && !token) return;
      setRestoring(true);
      try {
        const res = await api.get<MineResponse>("/support/threads/mine", { headers: token ? { "x-guest-token": token } : undefined, retry: false });
        if (res?.thread) {
          setThread(res.thread);
          setMessages(res.messages ?? []);
          if (!openRef.current) setUnread(res.thread.unreadForUser ?? 0);
        }
      } catch {
        /* API unavailable — the widget stays usable for new questions */
      } finally {
        setRestoring(false);
      }
    },
    [authed],
  );

  React.useEffect(() => {
    const token = readGuestToken();
    setGuestToken(token);
    void restore(token);
  }, [restore]);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    const onRefresh = () => {
      const token = readGuestToken();
      setGuestToken(token);
      void restore(token);
    };
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen);
    window.addEventListener(SUPPORT_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen);
      window.removeEventListener(SUPPORT_REFRESH_EVENT, onRefresh);
    };
  }, [restore]);

  // ── real-time channel
  const onEvent = React.useCallback((e: SupportEvent) => {
    const current = threadRef.current;
    switch (e.type) {
      case "message": {
        const m = e.message;
        if (current && m.threadId !== current.id) return;
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          if (m.senderType === "USER") {
            const idx = prev.findIndex((x) => x.pending && x.body === m.body);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = m;
              return next;
            }
          }
          return [...prev, m];
        });
        if (m.senderType !== "USER") {
          setAgentTyping(false);
          if (!openRef.current) setUnread((u) => u + 1);
        }
        break;
      }
      case "typing":
        if (e.from === "AGENT" && (!current || e.threadId === current.id)) {
          setAgentTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setAgentTyping(false), 4000);
        }
        break;
      case "presence":
        setAgentsOnline(e.agentsOnline);
        break;
      case "thread":
        if (current && e.thread.id === current.id) setThread(e.thread);
        break;
      default:
        break;
    }
  }, []);

  const socketEnabled = !!thread && thread.status !== "CLOSED" && !hidden;
  const { status, connected, send } = useSupportSocket({ enabled: socketEnabled, guestToken, onEvent });

  React.useEffect(() => () => clearTimeout(typingTimer.current), []);

  // mark as read while the panel is open
  React.useEffect(() => {
    if (!open) return;
    setUnread(0);
    if (thread && connected) send({ type: "read", threadId: thread.id });
  }, [open, thread, connected, send, messages.length]);

  // Esc closes; lock page scroll on phones (full-screen sheet)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 639px)").matches;
    const root = document.documentElement;
    const prev = root.style.overflow;
    if (small) root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
  }, [open]);

  // ── actions
  const startThread = async (input: { body: string; guestName?: string; guestPhone?: string }) => {
    const res = await api.post<StartResponse>("/support/threads", input, { retry: false });
    if (res.guestToken) {
      writeGuestToken(res.guestToken);
      setGuestToken(res.guestToken);
    }
    setThread(res.thread);
    setMessages(res.messages ?? []);
  };

  const deliverRest = async (tempId: string, body: string) => {
    const th = threadRef.current;
    if (!th) return;
    setMessages((p) => p.map((x) => (x.id === tempId ? { ...x, pending: true, failed: false } : x)));
    try {
      const m = await api.post<SupportMessage>(`/support/threads/${th.id}/messages`, { body }, { headers: guestHeaders(), retry: false });
      setMessages((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== tempId) : p.map((x) => (x.id === tempId ? m : x))));
    } catch {
      setMessages((p) => p.map((x) => (x.id === tempId ? { ...x, pending: false, failed: true } : x)));
    }
  };

  const sendMessage = (body: string) => {
    const th = threadRef.current;
    if (!th) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      threadId: th.id,
      senderType: "USER",
      sender: null,
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((p) => [...p, optimistic]);
    if (connected) {
      send({ type: "message", threadId: th.id, body });
      // no echo within 10 s → let the visitor retry over REST
      setTimeout(() => {
        setMessages((p) => p.map((x) => (x.id === tempId && x.pending ? { ...x, pending: false, failed: true } : x)));
      }, 10_000);
    } else {
      void deliverRest(tempId, body);
    }
  };

  const lastTyping = React.useRef(0);
  const notifyTyping = () => {
    const th = threadRef.current;
    if (!th || !connected) return;
    const now = Date.now();
    if (now - lastTyping.current < 2500) return;
    lastTyping.current = now;
    send({ type: "typing", threadId: th.id });
  };

  const resetThread = () => {
    setThread(null);
    setMessages([]);
    setAgentTyping(false);
  };

  if (hidden) return null;

  const online = connected && (agentsOnline === null || agentsOnline > 0);
  const reconnecting = socketEnabled && (status === "connecting" || status === "closed");

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-modal="false"
            aria-label={t("common.support.title")}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ink-950 shadow-lift sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[620px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-3xl sm:border sm:border-line-strong sm:bg-ink-900"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
          >
            {/* header */}
            <div className="relative overflow-hidden border-b border-line px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-gold-500/15 via-transparent to-transparent" />
              <div aria-hidden className="bg-blueprint absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
              <div className="relative flex items-center gap-3">
                <div className="relative">
                  <div className="grid size-11 place-items-center rounded-2xl border border-gold-500/30 bg-ink-850">
                    <LogoMark className="h-7" />
                  </div>
                  {thread && (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-ink-900",
                        online ? "bg-success" : "bg-ink-500",
                      )}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-stone-100">{t("common.support.title")}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-300">
                    {thread ? (
                      reconnecting ? (
                        <>
                          <Spinner className="size-3" /> {t("landing.support.reconnecting")}
                        </>
                      ) : (
                        <>
                          <span className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-ink-500")} />
                          {online ? t("common.support.online") : t("common.support.offline")}
                          <span className="text-ink-500">·</span>
                          <span className="truncate">{t("common.support.subtitle")}</span>
                        </>
                      )
                    ) : (
                      <span className="truncate">{t("common.support.subtitle")}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  aria-label={t("landing.support.close")}
                  className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink-300 transition hover:bg-fg/5 hover:text-stone-100"
                >
                  <CloseCircle size={20} />
                </button>
              </div>
            </div>

            {restoring && !thread ? (
              <div className="grid flex-1 place-items-center">
                <Spinner className="size-6 text-gold-400" />
              </div>
            ) : thread ? (
              <ChatView
                thread={thread}
                messages={messages}
                agentTyping={agentTyping}
                locale={locale}
                onSend={sendMessage}
                onRetry={(m) => void deliverRest(m.id, m.body)}
                onTyping={notifyTyping}
                onNewChat={resetThread}
              />
            ) : (
              <IntroForm authed={authed} userName={user?.name ?? null} onStart={startThread} />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* launcher */}
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t("landing.support.close") : t("landing.support.open")}
        aria-expanded={open}
        className={cn(
          "group fixed bottom-5 right-5 z-40 grid size-14 cursor-pointer place-items-center rounded-full bg-gold-gradient text-onyx shadow-glow transition-transform hover:scale-105 active:scale-95",
          open && "hidden sm:grid",
        )}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
      >
        {unread > 0 && !open && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-gold-400" />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "chat"}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25 }}
            className="relative grid place-items-center"
          >
            {open ? <CloseCircle size={26} /> : <Messages3 size={26} variant="Bold" />}
          </motion.span>
        </AnimatePresence>
        {unread > 0 && !open && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink-950 bg-danger px-1 font-mono text-[10px] font-bold"
            style={{ color: "#fff" }}
            aria-label={t("landing.support.unread", { n: unread })}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>
    </>
  );
}

/* ───────────────────────────── intro (no thread yet) ───────────────────────────── */

function IntroForm({
  authed,
  userName,
  onStart,
}: {
  authed: boolean;
  userName: string | null;
  onStart: (input: { body: string; guestName?: string; guestPhone?: string }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<{ phone?: string; body?: string }>({});
  const msgRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => msgRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { phone?: string; body?: string } = {};
    const text = body.trim();
    if (!text) errs.body = t("landing.support.messageRequired");
    let normalized: string | undefined;
    if (!authed && phone.trim()) {
      normalized = normalizeUzPhone(phone) ?? undefined;
      if (!normalized) errs.phone = t("landing.support.phoneInvalid");
    }
    setFieldError(errs);
    if (errs.body || errs.phone) return;
    setBusy(true);
    setError(null);
    try {
      await onStart({ body: text, guestName: authed ? undefined : name.trim() || undefined, guestPhone: authed ? undefined : normalized });
    } catch {
      setError(t("landing.support.startError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="flex items-end gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-ink-850">
            <LogoMark className="h-5" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-ink-850 px-4 py-3 text-sm leading-relaxed text-ink-100">
            {userName ? `${userName}, ` : ""}
            {t("common.support.greeting")}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-ink-900/60 p-4">
          <div className="text-sm font-semibold text-stone-100">{t("landing.support.introTitle")}</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">{t("landing.support.introText")}</p>
          <div className="mt-4 space-y-3">
            {!authed && (
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("common.support.namePlaceholder")}
                  aria-label={t("common.support.namePlaceholder")}
                  autoComplete="name"
                  className="h-10"
                />
                <div>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 __ ___ __ __"
                    aria-label={t("common.support.phonePlaceholder")}
                    aria-invalid={!!fieldError.phone || undefined}
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-10 font-mono"
                  />
                </div>
              </div>
            )}
            {fieldError.phone && <p className="text-xs text-danger">{fieldError.phone}</p>}
            <Textarea
              ref={msgRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
              }}
              placeholder={t("landing.support.firstMessagePlaceholder")}
              aria-label={t("landing.support.messageLabel")}
              aria-invalid={!!fieldError.body || undefined}
              className="min-h-24 resize-none"
              maxLength={2000}
            />
            {fieldError.body && <p className="text-xs text-danger">{fieldError.body}</p>}
          </div>
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <Warning2 size={16} variant="Bold" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="space-y-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy}>
          {!busy && <Send2 variant="Bold" />}
          {t("common.support.start")}
        </Button>
        <a href={t("common.contact.phoneHref")} className="flex items-center justify-center gap-2 text-xs text-ink-400 transition hover:text-gold-300">
          <Call size={14} />
          {t("landing.support.callUs")}: <span className="font-mono text-ink-200">{t("common.contact.phone")}</span>
        </a>
      </div>
    </form>
  );
}

/* ───────────────────────────── conversation ───────────────────────────── */

function ChatView({
  thread,
  messages,
  agentTyping,
  locale,
  onSend,
  onRetry,
  onTyping,
  onNewChat,
}: {
  thread: SupportThread;
  messages: ChatMessage[];
  agentTyping: boolean;
  locale: ReturnType<typeof useI18n>["locale"];
  onSend: (body: string) => void;
  onRetry: (m: ChatMessage) => void;
  onTyping: () => void;
  onNewChat: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const closed = thread.status === "CLOSED";

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, agentTyping]);

  React.useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || closed) return;
    onSend(body);
    setDraft("");
    inputRef.current?.focus();
  };

  const todayKey = new Date().toDateString();
  let lastDay = "";

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite" aria-relevant="additions">
        <div className="space-y-2.5">
          {messages.map((m) => {
            const d = new Date(m.createdAt);
            const dayKey = d.toDateString();
            const showDay = dayKey !== lastDay;
            lastDay = dayKey;
            const mine = m.senderType === "USER";
            const system = m.senderType === "SYSTEM";
            return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex items-center gap-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                    <span className="h-px flex-1 bg-line" />
                    {dayKey === todayKey ? t("landing.support.today") : fmtDate(d, locale)}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                {system ? (
                  <div className="mx-auto max-w-[90%] rounded-xl bg-fg/5 px-3 py-2 text-center text-xs text-ink-300">{m.body}</div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && (
                      <div className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-ink-850">
                        <LogoMark className="h-4" />
                      </div>
                    )}
                    <div className={cn("max-w-[80%]", mine && "items-end text-right")}>
                      {!mine && m.sender?.fullName && <div className="mb-1 pl-1 text-[11px] text-ink-400">{m.sender.fullName}</div>}
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed",
                          mine ? "rounded-br-md bg-gold-gradient text-onyx" : "rounded-bl-md border border-line bg-ink-850 text-ink-100",
                          m.pending && "opacity-70",
                          m.failed && "ring-1 ring-danger/60",
                        )}
                      >
                        {m.body}
                      </div>
                      <div className={cn("mt-1 flex items-center gap-1.5 px-1 text-[10px] text-ink-500", mine ? "justify-end" : "justify-start")}>
                        {m.failed ? (
                          <button type="button" onClick={() => onRetry(m)} className="inline-flex cursor-pointer items-center gap-1 text-danger hover:underline">
                            <Refresh size={11} />
                            {t("landing.support.failed")} · {t("landing.support.retry")}
                          </button>
                        ) : m.pending ? (
                          <span>{t("landing.support.sending")}</span>
                        ) : (
                          <time dateTime={m.createdAt}>{fmtTime(m.createdAt)}</time>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </React.Fragment>
            );
          })}
          <AnimatePresence>
            {agentTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-end gap-2"
              >
                <div className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-ink-850">
                  <LogoMark className="h-4" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-ink-850 px-3.5 py-3" aria-label={`${t("landing.support.agent")} ${t("common.support.typing")}`}>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-1.5 rounded-full bg-gold-400"
                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      {closed ? (
        <div className="space-y-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-xs text-ink-400">{t("landing.support.closedThread")}</p>
          <Button type="button" variant="gold" className="w-full" onClick={onNewChat}>
            {t("landing.support.newChat")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("common.support.placeholder")}
            aria-label={t("landing.support.messageLabel")}
            maxLength={2000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-ink-850 px-3.5 py-3 text-sm text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10"
          />
          <Button type="submit" variant="gold" size="icon" className="size-11 shrink-0" disabled={!draft.trim()} aria-label={t("landing.support.send")}>
            <Send2 variant="Bold" />
          </Button>
        </form>
      )}
    </>
  );
}
