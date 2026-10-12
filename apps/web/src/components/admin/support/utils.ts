"use client";
import type { SupportMessage, SupportThread } from "@/lib/types";

export type LocalMessage = SupportMessage & {
  /** optimistic state for agent messages */
  local?: "sending" | "failed";
  /** stable React key that survives the optimistic → server id swap */
  key?: string;
};

export const STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
export type ThreadStatus = (typeof STATUSES)[number];

export function threadName(t: SupportThread, guest: string) {
  return t.user?.fullName || t.guestName || guest;
}

export function threadPhone(t: SupportThread) {
  return t.user?.phone || t.guestPhone || null;
}

export const byRecent = (a: SupportThread, b: SupportThread) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

export function tempId() {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Same sender within 5 minutes → visually grouped bubbles */
export function sameGroup(a: LocalMessage | undefined, b: LocalMessage | undefined) {
  if (!a || !b) return false;
  if (a.senderType !== b.senderType || a.senderType === "SYSTEM") return false;
  if ((a.sender?.id ?? null) !== (b.sender?.id ?? null)) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
}

export function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

let audioCtx: AudioContext | null = null;
/** Soft two-tone chime generated with WebAudio (no asset needed). */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [
      { f: 880, at: 0 },
      { f: 1318.5, at: 0.11 },
    ].forEach(({ f, at }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, now + at);
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(0.09, now + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(now + at);
      o.stop(now + at + 0.5);
    });
  } catch {
    /* audio is optional */
  }
}

const SOUND_KEY = "eka_admin_sound";
export function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}
export function writeSoundPref(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}
