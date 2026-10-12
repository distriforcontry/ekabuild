"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Call, Clock, Danger, MessageQuestion, Send2, Timer1, TickCircle } from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { useSupportSocket, type SupportEvent } from "@/lib/realtime";
import type { SupportMessage, SupportThread } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { dayKey, useFmt } from "../format";
import { ErrorState } from "../states";
import { PageHead } from "../kit";

type Msg = SupportMessage & { local?: "pending" | "failed" };

export function SupportChat() {
  const { t, raw } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const [thread, setThread] = React.useState<SupportThread | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  const [text, setText] = React.useState("");
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [agentsOnline, setAgentsOnline] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [unseen, setUnseen] = React.useState(0);
  const scroller = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTypingSent = React.useRef(0);
  const threadRef = React.useRef<SupportThread | null>(null);
  threadRef.current = thread;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ thread: SupportThread | null; messages: SupportMessage[] }>("/support/threads/mine");
      setThread(res?.thread ?? null);
      setMessages(res?.messages ?? []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const onEvent = React.useCallback((e: SupportEvent) => {
    const th = threadRef.current;
    switch (e.type) {
      case "message": {
        const m = e.message;
        if (th && m.threadId !== th.id) return;
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          if (m.senderType === "USER") {
            const i = prev.findIndex((x) => x.local && x.body === m.body);
            if (i >= 0) {
              const next = prev.slice();
              next[i] = m;
              return next;
            }
          }
          return [...prev, m];
        });
        if (m.senderType === "AGENT") {
          setAgentTyping(false);
          if (document.visibilityState === "visible" && th) sendRef.current({ type: "read", threadId: th.id });
        }
        break;
      }
      case "typing":
        if (e.from === "AGENT" && (!th || e.threadId === th.id)) {
          setAgentTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setAgentTyping(false), 4000);
        }
        break;
      case "thread":
        if (th && e.thread.id === th.id) setThread(e.thread);
        break;
      case "presence":
        setAgentsOnline(e.agentsOnline);
        break;
    }
  }, []);

  const { status, send } = useSupportSocket({ enabled: !loading && !error, onEvent });
  const sendRef = React.useRef(send);
  sendRef.current = send;

  // auto-scroll
  const scrollToBottom = (smooth = true) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  const lastLen = React.useRef(0);
  React.useEffect(() => {
    const added = messages.length - lastLen.current;
    lastLen.current = messages.length;
    if (added <= 0) return;
    const last = messages[messages.length - 1];
    if (atBottom || last?.senderType === "USER") {
      requestAnimationFrame(() => scrollToBottom(added < 5));
      setUnseen(0);
    } else setUnseen((u) => u + added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  React.useEffect(() => {
    if (agentTyping && atBottom) requestAnimationFrame(() => scrollToBottom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentTyping]);
  React.useEffect(() => {
    if (!loading) requestAnimationFrame(() => scrollToBottom(false));
  }, [loading]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  const deliver = async (body: string, tempId: string) => {
    const th = threadRef.current;
    try {
      if (!th || th.status === "CLOSED") {
        const res = await api.post<{ thread: SupportThread; messages: SupportMessage[] }>("/support/threads", { body });
        setThread(res.thread);
        setMessages((prev) => {
          const keep = th && th.status === "CLOSED" ? [] : prev.filter((m) => m.id !== tempId && !m.local);
          const ids = new Set(keep.map((m) => m.id));
          return [...keep, ...res.messages.filter((m) => !ids.has(m.id))];
        });
      } else {
        const m = await api.post<SupportMessage>(`/support/threads/${th.id}/messages`, { body });
        setMessages((prev) => {
          const withoutTemp = prev.filter((x) => x.id !== tempId);
          return withoutTemp.some((x) => x.id === m.id) ? withoutTemp : [...withoutTemp, m].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        });
      }
    } catch {
      setMessages((prev) => prev.map((x) => (x.id === tempId ? { ...x, local: "failed" } : x)));
    }
  };

  const submit = (raw?: string) => {
    const body = (raw ?? text).trim();
    if (!body) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: Msg = {
      id: tempId,
      threadId: thread?.id ?? "",
      senderType: "USER",
      sender: { id: user.id, fullName: user.fullName },
      body,
      createdAt: new Date().toISOString(),
      local: "pending",
    };
    setMessages((prev) => [...prev, temp]);
    if (raw === undefined) setText("");
    void deliver(body, tempId);
    inputRef.current?.focus();
  };

  const retry = (m: Msg) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, local: "pending" } : x)));
    void deliver(m.body, m.id);
  };

  const onType = (v: string) => {
    setText(v);
    const th = threadRef.current;
    if (th && th.status !== "CLOSED" && Date.now() - lastTypingSent.current > 2500) {
      lastTypingSent.current = Date.now();
      send({ type: "typing", threadId: th.id });
    }
  };

  // autosize
  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [text]);

  const statusLine =
    status === "open"
      ? agentsOnline === null
        ? t("common.support.online")
        : agentsOnline > 0
          ? t("app.support.online", { n: agentsOnline })
          : t("app.support.noAgents")
      : status === "closed"
        ? t("app.support.reconnecting")
        : t("app.support.connecting");
  const live = status === "open";
  const quick = raw<string[]>("app.support.quick") ?? [];
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const dayLabel = (d: string) => (dayKey(d) === today ? t("app.common.today") : dayKey(d) === yesterday ? t("app.common.yesterday") : fmt.date(d));

  return (
    <div>
      <PageHead icon={MessageQuestion} eyebrow={t("app.shell.area")} title={t("app.support.title")} description={t("app.support.subtitle")} className="mb-6" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="relative flex h-[calc(100dvh-15rem-var(--shell-bottom,0px))] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card">
          {/* header */}
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-5">
            <span className="relative grid size-11 place-items-center rounded-full border border-gold-500/30 bg-ink-850">
              <LogoMark className="h-6" />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-ink-900 transition-colors",
                  live ? (agentsOnline === 0 ? "bg-warning" : "bg-success") : "bg-ink-500",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-stone-100">{t("app.support.agent")}</div>
              <div className="flex items-center gap-1.5 text-xs text-ink-400" aria-live="polite">
                {!live && <span className="size-1.5 animate-pulse rounded-full bg-warning" />}
                {statusLine}
              </div>
            </div>
          </header>

          {/* messages */}
          <div ref={scroller} onScroll={onScroll} className="relative flex-1 overflow-y-auto px-3 py-5 md:px-6" aria-live="polite">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-14 w-2/3 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                <Skeleton className="h-20 w-3/5 rounded-2xl" />
              </div>
            ) : error ? (
              <ErrorState error={error} onRetry={load} className="m-auto max-w-md border-none" />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
                {/* greeting */}
                <AgentBubble body={t("common.support.greeting")} first />
                {messages.length === 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 text-center">
                    <div className="text-sm font-semibold text-stone-100">{t("app.support.startTitle")}</div>
                    <p className="mt-1 text-xs text-ink-400">{t("app.support.startHint")}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {quick.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => submit(q)}
                          className="cursor-pointer rounded-full border border-gold-500/30 bg-gold-500/[0.06] px-3.5 py-2 text-xs font-medium text-gold-200 transition hover:-translate-y-0.5 hover:bg-gold-500/15"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const grouped = !newDay && prev && prev.senderType === m.senderType && +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60_000;
                  return (
                    <React.Fragment key={m.id}>
                      {newDay && (
                        <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                          <span className="h-px flex-1 bg-line" />
                          {dayLabel(m.createdAt)}
                          <span className="h-px flex-1 bg-line" />
                        </div>
                      )}
                      {m.senderType === "SYSTEM" ? (
                        <div className="my-2 self-center rounded-full bg-fg/5 px-3 py-1 text-center text-[11px] text-ink-400">{m.body}</div>
                      ) : m.senderType === "USER" ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.25 }}
                          className={cn("flex max-w-[85%] flex-col items-end self-end md:max-w-[70%]", !grouped && "mt-2")}
                        >
                          <div
                            className={cn(
                              "whitespace-pre-wrap break-words rounded-2xl rounded-br-md border px-4 py-2.5 text-sm leading-relaxed",
                              m.local === "failed" ? "border-danger/40 bg-danger/10 text-stone-100" : "border-gold-500/30 bg-gold-500/[0.14] text-stone-100",
                              m.local === "pending" && "opacity-70",
                            )}
                          >
                            {m.body}
                          </div>
                          <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-ink-500">
                            {m.local === "pending" ? (
                              <>
                                <Clock size={11} /> {t("app.support.sending")}
                              </>
                            ) : m.local === "failed" ? (
                              <button type="button" onClick={() => retry(m)} className="inline-flex cursor-pointer items-center gap-1 text-danger hover:underline">
                                <Danger size={11} /> {t("app.support.failed")} · {t("app.support.retry")}
                              </button>
                            ) : (
                              <>
                                {fmt.time(m.createdAt)} <TickCircle size={11} variant="Bold" className="text-gold-400" />
                              </>
                            )}
                          </div>
                        </motion.div>
                      ) : (
                        <AgentBubble body={m.body} name={grouped ? undefined : m.sender?.fullName} time={fmt.time(m.createdAt)} first={!grouped} />
                      )}
                    </React.Fragment>
                  );
                })}
                <AnimatePresence>
                  {agentTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mt-2 flex items-center gap-2 self-start"
                      aria-label={t("app.support.typing")}
                    >
                      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-ink-800 px-4 py-3">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            className="size-1.5 rounded-full bg-ink-300"
                            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                          />
                        ))}
                      </span>
                      <span className="text-[11px] text-ink-400">{t("app.support.typing")}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {thread?.status === "CLOSED" && (
                  <div className="mt-4 rounded-xl border border-line bg-ink-850 px-4 py-3 text-center text-xs text-ink-300">{t("app.support.closed")}</div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {unseen > 0 && !atBottom && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={() => scrollToBottom()}
                className="absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-gold-gradient px-3.5 py-1.5 text-xs font-semibold text-onyx shadow-glow"
              >
                <ArrowDown size={14} /> {t("app.support.newMessages")} · {unseen}
              </motion.button>
            )}
          </AnimatePresence>

          {/* composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="border-t border-line bg-ink-900/90 p-3 md:p-4"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-ink-850 p-1.5 pl-4 transition focus-within:border-gold-500/50 focus-within:ring-4 focus-within:ring-gold-500/10">
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                disabled={loading || Boolean(error)}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={t("app.support.placeholder")}
                aria-label={t("app.support.placeholder")}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-sm leading-relaxed text-stone-100 placeholder:text-ink-400 focus:outline-none"
              />
              <Button type="submit" variant="gold" size="icon" disabled={!text.trim()} aria-label={t("app.support.send")}>
                <Send2 size={18} variant="Bold" />
              </Button>
            </div>
            <div className="mt-1.5 hidden px-2 text-[10px] text-ink-500 md:block">{t("app.support.enterHint")}</div>
          </form>
        </section>

        {/* side */}
        <aside className="space-y-4">
          <Card className="relative overflow-hidden">
            <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60" />
            <CardContent className="relative">
              <span className="grid size-11 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                <Call size={20} variant="Bulk" />
              </span>
              <div className="mt-4 text-xs uppercase tracking-wider text-ink-400">{t("app.support.contactCard")}</div>
              <a href={t("common.contact.phoneHref")} className="mt-1 block font-mono text-lg font-semibold text-stone-100 transition hover:text-gold-300">
                {t("common.contact.phone")}
              </a>
              <div className="mt-4 flex items-center gap-2 text-sm text-ink-300">
                <Timer1 size={16} className="text-ink-400" />
                <span>
                  {t("app.support.hours")}: {t("common.contact.hours")}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3">
              <MessageQuestion size={22} variant="Bulk" className="shrink-0 text-gold-300" />
              <div className="text-sm text-ink-300">
                <div className="font-semibold text-stone-100">{t("common.support.title")}</div>
                <p className="mt-1 text-xs leading-relaxed">{t("common.support.subtitle")}</p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="grid size-6 place-items-center rounded-full bg-gold-gradient text-[10px] font-bold text-onyx">{initials(user.fullName)}</span>
                  <span className="truncate text-ink-200">{user.fullName}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AgentBubble({ body, name, time, first }: { body: string; name?: string; time?: string; first?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex max-w-[85%] items-end gap-2 self-start md:max-w-[70%]", first && "mt-2")}
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border border-gold-500/25 bg-ink-850", !first && "invisible")}>
        <LogoMark className="h-4" />
      </span>
      <div>
        {name && <div className="mb-1 px-1 text-[11px] font-semibold text-ink-400">{name}</div>}
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-ink-800 px-4 py-2.5 text-sm leading-relaxed text-ink-100">{body}</div>
        {time && <div className="mt-1 px-1 text-[10px] text-ink-500">{time}</div>}
      </div>
    </motion.div>
  );
}
