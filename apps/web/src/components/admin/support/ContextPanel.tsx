"use client";
import * as React from "react";
import Link from "next/link";
import { Call, Clock, LockCircle, Profile, Receipt2, Refresh, User, UserTick } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import type { SupportThread } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useFormat } from "../format";
import { CopyChip } from "../primitives";
import { ThreadStatusBadge } from "./Conversation";
import { threadName, threadPhone, type ThreadStatus } from "./utils";

export function ContextPanel({
  thread,
  meId,
  busy,
  onStatus,
  onAssignMe,
  messageCount,
}: {
  thread: SupportThread;
  meId: string;
  busy: string | null;
  onStatus: (s: ThreadStatus) => void;
  onAssignMe: () => void;
  messageCount: number;
}) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const name = threadName(thread, t("admin.support.guest"));
  const phone = threadPhone(thread);
  const closed = thread.status === "CLOSED";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-2xl text-lg font-bold",
            thread.user ? "bg-gold-gradient text-onyx shadow-glow" : "border border-dashed border-line-strong bg-ink-800 text-ink-300",
          )}
        >
          {thread.user ? initials(name) : <Profile size={28} variant="Bulk" />}
        </span>
        <div className="mt-3 text-base font-semibold text-stone-100">{tr(name)}</div>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          <Badge tone={thread.user ? "gold" : "neutral"}>
            {thread.user ? <User variant="Bold" /> : <Profile variant="Bold" />}
            {thread.user ? t("admin.support.registered") : t("admin.support.guest")}
          </Badge>
          <ThreadStatusBadge status={thread.status} />
        </div>
      </div>

      <Section title={t("admin.support.context.contact")}>
        <Row label={t("admin.support.context.phone")}>
          {phone ? (
            <a href={`tel:${phone.replace(/\s/g, "")}`} title={t("admin.support.context.call")} className="inline-flex items-center gap-1.5 font-mono text-stone-100 transition hover:text-gold-300">
              <Call size={13} /> {phone}
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label={t("admin.support.context.subject")}>{thread.subject ? tr(thread.subject) : <span className="text-ink-500">{t("admin.support.context.noSubject")}</span>}</Row>
        <Row label={t("admin.support.context.started")}>{f.dateTime(thread.createdAt)}</Row>
        <Row label={t("admin.support.context.lastActivity")}>{f.relative(thread.lastMessageAt)}</Row>
        <Row label={t("admin.support.context.assignee")}>
          {thread.assignedTo ? (thread.assignedTo.id === meId ? t("admin.support.you") : thread.assignedTo.fullName) : <span className="text-ink-500">{t("admin.support.unassigned")}</span>}
        </Row>
        <Row label={t("admin.support.context.threadId")}>
          <CopyChip value={thread.id} display={`…${thread.id.slice(-8)}`} />
        </Row>
        <Row label={t("admin.support.context.messages")}>
          <span className="font-mono text-xs text-ink-300">{messageCount}</span>
        </Row>
      </Section>

      {thread.user && (
        <Section>
          <div className="grid gap-2">
            <Button variant="secondary" size="sm" asChild className="justify-start">
              <Link href={`/admin/purchases?q=${encodeURIComponent(thread.user.phone)}`}>
                <Receipt2 /> {t("admin.support.context.purchases")}
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild className="justify-start">
              <Link href={`/admin/users?q=${encodeURIComponent(thread.user.phone)}`}>
                <User /> {t("admin.support.context.profile")}
              </Link>
            </Button>
          </div>
        </Section>
      )}

      <Section title={t("admin.support.context.actions")}>
        <div className="grid gap-2">
          {thread.assignedTo?.id !== meId && (
            <Button variant="outline" size="sm" className="justify-start" onClick={onAssignMe} loading={busy === "assign"}>
              <UserTick /> {t("admin.support.context.assignMe")}
            </Button>
          )}
          {thread.status === "OPEN" && (
            <Button variant="secondary" size="sm" className="justify-start" onClick={() => onStatus("PENDING")} loading={busy === "PENDING"}>
              <Clock /> {t("admin.support.context.markPending")}
            </Button>
          )}
          {closed ? (
            <Button variant="secondary" size="sm" className="justify-start" onClick={() => onStatus("OPEN")} loading={busy === "OPEN"}>
              <Refresh /> {t("admin.support.context.reopen")}
            </Button>
          ) : (
            <>
              {thread.status === "PENDING" && (
                <Button variant="secondary" size="sm" className="justify-start" onClick={() => onStatus("OPEN")} loading={busy === "OPEN"}>
                  <Refresh /> {t("admin.support.context.reopen")}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="justify-start text-danger hover:text-danger" onClick={() => onStatus("CLOSED")} loading={busy === "CLOSED"}>
                <LockCircle /> {t("admin.support.context.close")}
              </Button>
            </>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">{title}</h4>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className="min-w-0 truncate text-right text-ink-100">{children}</span>
    </div>
  );
}
