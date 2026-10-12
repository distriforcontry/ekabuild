"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { Clock, LockCircle, MessageText1, People, Timer1, VolumeHigh, VolumeSlash } from "iconsax-reactjs";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { SupportEvent } from "@/lib/realtime";
import type { Paginated, SupportMessage, SupportThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAdmin, useSupportEvents } from "../context";
import { useListState } from "../hooks";
import { ErrorNotice, Sheet } from "../primitives";
import type { SupportStats } from "../types";
import { ContextPanel } from "./ContextPanel";
import { Conversation } from "./Conversation";
import { ThreadList } from "./ThreadList";
import { STATUSES, byRecent, playChime, readSoundPref, tempId, threadName, writeSoundPref, type LocalMessage, type ThreadStatus } from "./utils";

const PAGE_SIZE = 30;
const TYPING_TTL = 4_000;
const ECHO_TIMEOUT = 10_000;

type Active = { thread: SupportThread; messages: LocalMessage[] };

/**
 * Real-time support inbox: thread list ⟷ conversation ⟷ context panel.
 * Initial data over REST, live updates over the shared admin WebSocket (see AdminShell / lib/realtime.ts).
 */
export function SupportInbox() {
  const { t, tr } = useI18n();
  const { user: me, realtime, refreshCounts } = useAdmin();
  const sp = useSearchParams();
  const list = useListState(["status", "thread"] as const);
  const rawStatus = sp.get("status");
  const status: ThreadStatus = (STATUSES as readonly string[]).includes(rawStatus ?? "") ? (rawStatus as ThreadStatus) : "OPEN";
  const q = list.q;
  const activeId = sp.get("thread");

  // ── refs mirror state for socket handlers
  const statusRef = React.useRef(status);
  statusRef.current = status;
  const qRef = React.useRef(q);
  qRef.current = q;
  const activeRef = React.useRef(activeId);
  activeRef.current = activeId;
  const realtimeRef = React.useRef(realtime);
  realtimeRef.current = realtime;

  // ── thread list
  const [threads, setThreads] = React.useState<SupportThread[]>([]);
  const threadsRef = React.useRef(threads);
  threadsRef.current = threads;
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [listLoading, setListLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const fetchThreads = React.useCallback(
    async (p = 1) => {
      if (p === 1) setListLoading(true);
      else setLoadingMore(true);
      setListError(null);
      try {
        const res = await api.get<Paginated<SupportThread>>("/admin/support/threads", { query: { status, q: q || undefined, page: p, pageSize: PAGE_SIZE } });
        const items = Array.isArray(res) ? (res as SupportThread[]) : (res.items ?? []);
        setThreads((cur) => {
          const merged = p === 1 ? items : [...cur, ...items.filter((x) => !cur.some((c) => c.id === x.id))];
          return merged
            .map((x) => (x.id === activeRef.current && document.visibilityState === "visible" ? { ...x, unreadForAgent: 0 } : x))
            .sort(byRecent);
        });
        setTotal(Array.isArray(res) ? items.length : (res.total ?? items.length));
        setPage(p);
      } catch (e) {
        setListError(errorMessage(e));
        if (p === 1) setThreads([]);
      } finally {
        setListLoading(false);
        setLoadingMore(false);
      }
    },
    [status, q],
  );

  React.useEffect(() => {
    fetchThreads(1);
  }, [fetchThreads]);

  // ── header stats
  const [stats, setStats] = React.useState<SupportStats | null>(null);
  const loadStats = React.useCallback(() => {
    api
      .get<SupportStats>("/admin/support/stats")
      .then(setStats)
      .catch(() => {});
  }, []);
  const statsTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshStats = React.useCallback(() => {
    clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(loadStats, 800);
  }, [loadStats]);
  React.useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, [loadStats]);

  // ── active conversation
  const [active, setActive] = React.useState<Active | null>(null);
  const [activeLoading, setActiveLoading] = React.useState(false);
  const [activeError, setActiveError] = React.useState<string | null>(null);
  const [readUpTo, setReadUpTo] = React.useState(0);
  const [nonce, setNonce] = React.useState(0);

  const markLocalRead = React.useCallback((id: string) => {
    setThreads((ts) => ts.map((x) => (x.id === id && x.unreadForAgent ? { ...x, unreadForAgent: 0 } : x)));
  }, []);

  React.useEffect(() => {
    if (!activeId) {
      setActive(null);
      return;
    }
    let alive = true;
    const seed = threadsRef.current.find((x) => x.id === activeId);
    setActive((a) => (a?.thread.id === activeId ? a : seed ? { thread: seed, messages: [] } : null));
    setActiveLoading(true);
    setActiveError(null);
    setReadUpTo(0);
    realtimeRef.current.send({ type: "subscribe", threadId: activeId });
    realtimeRef.current.send({ type: "read", threadId: activeId });
    markLocalRead(activeId);
    api
      .get<{ thread: SupportThread; messages: SupportMessage[] }>(`/admin/support/threads/${activeId}`)
      .then((res) => {
        if (!alive) return;
        setActive((a) => {
          // keep optimistic messages that the server doesn't know about yet
          const pending = a?.thread.id === activeId ? a.messages.filter((m) => m.local) : [];
          return { thread: res.thread, messages: [...(res.messages ?? []), ...pending] };
        });
        if (res.thread.unreadForUser === 0) setReadUpTo(Date.now());
      })
      .catch((e) => alive && setActiveError(errorMessage(e)))
      .finally(() => alive && setActiveLoading(false));
    return () => {
      alive = false;
    };
  }, [activeId, nonce, markLocalRead]);

  // ── reconnect → resubscribe + catch up on missed events
  const everOpen = React.useRef(false);
  const catchUp = React.useRef(() => {});
  catchUp.current = () => {
    if (activeRef.current) setNonce((n) => n + 1);
    fetchThreads(1);
    loadStats();
  };
  React.useEffect(() => {
    if (realtime.status !== "open") return;
    if (everOpen.current) catchUp.current();
    everOpen.current = true;
  }, [realtime.status]);

  // ── read receipts when the tab becomes visible again
  React.useEffect(() => {
    const onVis = () => {
      const id = activeRef.current;
      if (document.visibilityState === "visible" && id) {
        realtimeRef.current.send({ type: "read", threadId: id });
        markLocalRead(id);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markLocalRead]);

  // ── typing indicators (incoming)
  const [typing, setTyping] = React.useState<Record<string, boolean>>({});
  const typingTimers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const setTypingFor = React.useCallback((threadId: string, on: boolean) => {
    clearTimeout(typingTimers.current.get(threadId));
    setTyping((s) => (Boolean(s[threadId]) === on ? s : { ...s, [threadId]: on }));
    if (on) typingTimers.current.set(threadId, setTimeout(() => setTyping((s) => ({ ...s, [threadId]: false })), TYPING_TTL));
  }, []);

  // ── sound
  const [sound, setSound] = React.useState(true);
  const soundRef = React.useRef(sound);
  soundRef.current = sound;
  React.useEffect(() => setSound(readSoundPref()), []);

  // ── optimistic sends
  const echoTimers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const updateActiveMessages = React.useCallback((threadId: string, fn: (ms: LocalMessage[]) => LocalMessage[]) => {
    setActive((a) => (a && a.thread.id === threadId ? { ...a, messages: fn(a.messages) } : a));
  }, []);

  const bumpThread = React.useCallback((m: Pick<SupportMessage, "threadId" | "body" | "senderType" | "createdAt">, unreadDelta: number) => {
    setThreads((ts) =>
      ts.some((x) => x.id === m.threadId)
        ? ts
            .map((x) =>
              x.id === m.threadId
                ? {
                    ...x,
                    lastMessage: { body: m.body, senderType: m.senderType, createdAt: m.createdAt },
                    lastMessageAt: m.createdAt,
                    unreadForAgent: unreadDelta < 0 ? 0 : x.unreadForAgent + unreadDelta,
                  }
                : x,
            )
            .sort(byRecent)
        : ts,
    );
  }, []);

  const restSend = React.useCallback(
    async (msg: LocalMessage) => {
      try {
        const saved = await api.post<SupportMessage | { message: SupportMessage }>(`/support/threads/${msg.threadId}/messages`, { body: msg.body });
        const real = saved && "message" in saved ? saved.message : (saved as SupportMessage);
        updateActiveMessages(msg.threadId, (ms) =>
          ms.some((x) => x.id === real?.id)
            ? ms.filter((x) => x.id !== msg.id)
            : ms.map((x) => (x.id === msg.id ? (real?.id ? { ...real, key: x.key ?? x.id } : { ...x, local: undefined }) : x)),
        );
      } catch {
        updateActiveMessages(msg.threadId, (ms) => ms.map((x) => (x.id === msg.id ? { ...x, local: "failed" } : x)));
      }
    },
    [updateActiveMessages],
  );

  const deliver = React.useCallback(
    (msg: LocalMessage) => {
      const rt = realtimeRef.current;
      if (rt.status === "open") {
        rt.send({ type: "message", threadId: msg.threadId, body: msg.body });
        echoTimers.current.set(
          msg.id,
          setTimeout(() => {
            updateActiveMessages(msg.threadId, (ms) => ms.map((x) => (x.id === msg.id && x.local === "sending" ? { ...x, local: "failed" } : x)));
          }, ECHO_TIMEOUT),
        );
      } else {
        restSend(msg);
      }
    },
    [restSend, updateActiveMessages],
  );

  const send = React.useCallback(
    (body: string) => {
      const threadId = activeRef.current;
      if (!threadId) return;
      const msg: LocalMessage = {
        id: tempId(),
        threadId,
        senderType: "AGENT",
        sender: { id: me.id, fullName: me.fullName },
        body,
        createdAt: new Date().toISOString(),
        local: "sending",
      };
      updateActiveMessages(threadId, (ms) => [...ms, msg]);
      bumpThread(msg, -1);
      deliver(msg);
    },
    [me.id, me.fullName, updateActiveMessages, bumpThread, deliver],
  );

  const retry = React.useCallback(
    (m: LocalMessage) => {
      const again: LocalMessage = { ...m, id: tempId(), local: "sending", createdAt: new Date().toISOString() };
      updateActiveMessages(m.threadId, (ms) => [...ms.filter((x) => x.id !== m.id), again]);
      restSend(again);
    },
    [updateActiveMessages, restSend],
  );

  // ── outgoing typing (throttled)
  const lastTyping = React.useRef(0);
  const onTyping = React.useCallback(() => {
    const id = activeRef.current;
    const rt = realtimeRef.current;
    if (!id || rt.status !== "open") return;
    const now = Date.now();
    if (now - lastTyping.current < 2_500) return;
    lastTyping.current = now;
    rt.send({ type: "typing", threadId: id });
  }, []);

  // ── socket events
  const upsertThread = React.useCallback((th: SupportThread) => {
    setThreads((ts) => {
      const i = ts.findIndex((x) => x.id === th.id);
      const isActive = th.id === activeRef.current;
      const fits = th.status === statusRef.current && (i >= 0 || !qRef.current);
      if (!fits) {
        if (i >= 0 && !isActive) return ts.filter((x) => x.id !== th.id);
        if (i >= 0) return ts.map((x) => (x.id === th.id ? { ...x, ...th } : x));
        return ts;
      }
      const merged: SupportThread = { ...(i >= 0 ? ts[i] : {}), ...th };
      if (isActive && document.visibilityState === "visible") merged.unreadForAgent = 0;
      const next = i >= 0 ? ts.map((x) => (x.id === th.id ? merged : x)) : [merged, ...ts];
      return next.sort(byRecent);
    });
    setActive((a) => (a && a.thread.id === th.id ? { ...a, thread: { ...a.thread, ...th } } : a));
  }, []);

  const onEvent = React.useCallback(
    (e: SupportEvent) => {
      switch (e.type) {
        case "thread": {
          const isNew = !threadsRef.current.some((x) => x.id === e.thread.id);
          upsertThread(e.thread);
          refreshStats();
          if (isNew && e.thread.status === "OPEN" && e.thread.lastMessage?.senderType === "USER" && soundRef.current) playChime();
          break;
        }
        case "message": {
          const m = e.message;
          const isActive = m.threadId === activeRef.current;
          const visible = document.visibilityState === "visible";
          if (isActive) {
            updateActiveMessages(m.threadId, (ms) => {
              if (ms.some((x) => x.id === m.id)) return ms;
              if (m.senderType === "AGENT" && (!m.sender || m.sender.id === me.id)) {
                const idx = ms.findIndex((x) => x.local && x.body === m.body);
                if (idx >= 0) {
                  clearTimeout(echoTimers.current.get(ms[idx]!.id));
                  return ms.map((x, i) => (i === idx ? { ...m, key: x.key ?? x.id } : x));
                }
              }
              return [...ms, m];
            });
            if (m.senderType === "USER") {
              setTypingFor(m.threadId, false);
              if (visible) realtimeRef.current.send({ type: "read", threadId: m.threadId });
            }
          }
          const unseen = m.senderType === "USER" && !(isActive && visible);
          bumpThread(m, unseen ? 1 : isActive && visible ? -1 : 0);
          if (unseen && soundRef.current) playChime();
          break;
        }
        case "typing":
          if (e.from === "USER") setTypingFor(e.threadId, true);
          break;
        case "read":
          if (e.by === "USER" && e.threadId === activeRef.current) setReadUpTo(Date.now());
          break;
        case "presence":
          setStats((s) => (s ? { ...s, agentsOnline: e.agentsOnline } : s));
          break;
        case "error":
          toast.error(e.message);
          break;
      }
    },
    [upsertThread, refreshStats, updateActiveMessages, setTypingFor, bumpThread, me.id],
  );
  useSupportEvents(onEvent);

  // ── thread actions
  const [busy, setBusy] = React.useState<string | null>(null);
  const patchThread = React.useCallback(
    async (body: { status?: ThreadStatus; assignedToId?: string }, key: string, success: string) => {
      const id = activeRef.current;
      if (!id) return;
      setBusy(key);
      try {
        const res = await api.patch<SupportThread | { thread: SupportThread } | undefined>(`/admin/support/threads/${id}`, body);
        const updated = res && "thread" in res ? res.thread : (res as SupportThread | undefined);
        const base = threadsRef.current.find((x) => x.id === id) ?? (active?.thread.id === id ? active.thread : null);
        const local: Partial<SupportThread> = {
          ...(body.status ? { status: body.status } : {}),
          ...(body.assignedToId ? { assignedTo: { id: me.id, fullName: me.fullName } } : {}),
        };
        if (updated?.id) upsertThread({ ...updated, ...local, ...(updated.assignedTo ? { assignedTo: updated.assignedTo } : {}) });
        else if (base) upsertThread({ ...base, ...local } as SupportThread);
        toast.success(success);
        refreshStats();
        refreshCounts();
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [active, me.id, me.fullName, upsertThread, refreshStats, refreshCounts],
  );

  const setThreadStatus = (s: ThreadStatus) => patchThread({ status: s }, s, t("admin.support.context.statusChanged"));
  const assignMe = () => patchThread({ assignedToId: me.id }, "assign", t("admin.support.context.assigned"));

  // ── unread counter in the tab title
  const unreadTotal = threads.reduce((s, x) => s + (x.unreadForAgent || 0), 0);
  const baseTitle = React.useRef<string | null>(null);
  React.useEffect(() => {
    baseTitle.current ??= document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unreadTotal ? `(${unreadTotal > 99 ? "99+" : unreadTotal}) ${baseTitle.current}` : baseTitle.current;
  }, [unreadTotal]);
  React.useEffect(
    () => () => {
      if (baseTitle.current) document.title = baseTitle.current;
    },
    [],
  );

  const [infoOpen, setInfoOpen] = React.useState(false);
  const open = (id: string) => list.update({ thread: id }, { resetPage: false });
  const back = () => list.update({ thread: null }, { resetPage: false });

  const currentThread = active?.thread ?? null;
  const counts: Partial<Record<ThreadStatus, number>> = stats ? { OPEN: stats.open, PENDING: stats.pending } : {};

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col md:h-[calc(100dvh-8rem)]">
      {/* header */}
      <div className={cn("mb-4 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", activeId ? "hidden lg:flex" : "flex")}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-100">{t("admin.support.title")}</h1>
          <ConnectionPill status={realtime.status} />
          <button
            type="button"
            onClick={() => {
              const next = !sound;
              setSound(next);
              writeSoundPref(next);
              if (next) playChime();
              toast(next ? t("admin.support.sound.on") : t("admin.support.sound.off"));
            }}
            className={cn(
              "grid size-9 cursor-pointer place-items-center rounded-xl border transition",
              sound ? "border-gold-500/30 bg-gold-500/10 text-gold-300" : "border-line text-ink-400 hover:text-stone-100",
            )}
            aria-pressed={sound}
            aria-label={sound ? t("admin.support.sound.on") : t("admin.support.sound.off")}
            title={sound ? t("admin.support.sound.on") : t("admin.support.sound.off")}
          >
            {sound ? <VolumeHigh size={16} variant="Bulk" /> : <VolumeSlash size={16} />}
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <StatChip icon={MessageText1} label={t("admin.support.stats.open")} value={stats?.open} tone="gold" />
          <StatChip icon={Clock} label={t("admin.support.stats.pending")} value={stats?.pending} />
          <StatChip icon={LockCircle} label={t("admin.support.stats.closedToday")} value={stats?.closedToday} />
          <StatChip icon={People} label={t("admin.support.stats.agents")} value={stats?.agentsOnline} live />
          <StatChip
            icon={Timer1}
            label={t("admin.support.stats.firstResponse")}
            value={stats?.avgFirstResponseMin != null ? t("admin.support.stats.minutes", { n: Math.round(stats.avgFirstResponseMin) }) : undefined}
          />
        </div>
      </div>

      <ErrorNotice error={listError} onRetry={() => fetchThreads(1)} />

      {/* panes */}
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <aside className={cn("min-h-0 border-line lg:block lg:border-r", activeId ? "hidden" : "block")}>
          <ThreadList
            threads={threads}
            status={status}
            onStatus={(s) => list.update({ status: s === "OPEN" ? null : s }, { resetPage: false })}
            counts={counts}
            query={q}
            onQuery={(v) => list.update({ q: v })}
            activeId={activeId}
            onOpen={open}
            typing={typing}
            loading={listLoading}
            hasMore={threads.length < total}
            loadingMore={loadingMore}
            onLoadMore={() => fetchThreads(page + 1)}
            meId={me.id}
          />
        </aside>

        <section className={cn("min-h-0 min-w-0 bg-ink-950/30 lg:block", activeId ? "block" : "hidden")}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeId ?? "none"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <Conversation
                thread={currentThread}
                messages={active?.messages ?? []}
                loading={Boolean(activeId) && activeLoading}
                error={activeError}
                onReload={() => setNonce((n) => n + 1)}
                typing={Boolean(activeId && typing[activeId])}
                readUpTo={readUpTo}
                meId={me.id}
                onSend={send}
                onRetry={retry}
                onTyping={onTyping}
                onBack={back}
                onInfo={() => setInfoOpen(true)}
                onStatus={setThreadStatus}
                onAssignMe={assignMe}
              />
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-line p-5 xl:block">
          {currentThread ? (
            <ContextPanel thread={currentThread} meId={me.id} busy={busy} onStatus={setThreadStatus} onAssignMe={assignMe} messageCount={active?.messages.length ?? 0} />
          ) : (
            <div className="grid h-full place-items-center text-center text-xs text-ink-500">{t("admin.support.select")}</div>
          )}
        </aside>
      </div>

      <Sheet
        open={infoOpen && Boolean(currentThread)}
        onOpenChange={setInfoOpen}
        title={currentThread ? tr(threadName(currentThread, t("admin.support.guest"))) : t("admin.support.context.title")}
        description={t("admin.support.context.title")}
        width="max-w-sm"
      >
        {currentThread && (
          <ContextPanel thread={currentThread} meId={me.id} busy={busy} onStatus={setThreadStatus} onAssignMe={assignMe} messageCount={active?.messages.length ?? 0} />
        )}
      </Sheet>
    </div>
  );
}

function ConnectionPill({ status }: { status: "idle" | "connecting" | "open" | "closed" }) {
  const { t } = useI18n();
  const live = status === "open";
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-[11px] font-semibold",
        live ? "border-success/30 bg-success/10 text-success" : status === "idle" ? "border-line text-ink-400" : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <span className="relative flex size-2">
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-success/70" />}
        <span className={cn("relative size-2 rounded-full", live ? "bg-success" : status === "idle" ? "bg-ink-500" : "animate-pulse bg-warning")} />
      </span>
      {t(`admin.support.connection.${status}`)}
    </span>
  );
}

function StatChip({ icon: Icon, label, value, tone, live }: { icon: IconType; label: string; value: number | string | undefined; tone?: "gold"; live?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-ink-900 py-1.5 pl-2 pr-3.5">
      <span className={cn("grid size-7 place-items-center rounded-lg", tone === "gold" ? "bg-gold-500/15 text-gold-300" : "bg-fg/5 text-ink-300")}>
        <Icon size={14} variant="Bulk" />
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
        <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-stone-100">
          {live && value != null && <span className="size-1.5 rounded-full bg-success" />}
          {value ?? "—"}
        </span>
      </span>
    </div>
  );
}
