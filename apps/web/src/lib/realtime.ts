"use client";
import * as React from "react";
import type { SupportMessage, SupportThread } from "./types";

/**
 * Real-time support channel over WebSocket: `/api/v1/support/ws`.
 * Auth: session cookie (users & agents) or `?guestToken=` for anonymous visitors.
 * Messages are fanned out across API replicas through Redis pub/sub, so any replica can serve the socket.
 *
 * Client → server:  { type: "message", threadId, body } | { type: "typing", threadId } | { type: "read", threadId }
 *                   | { type: "subscribe", threadId }   (agents open a thread)
 * Server → client:  { type: "message", message } | { type: "typing", threadId, from: "USER"|"AGENT", name? }
 *                   | { type: "thread", thread } (agents: new / updated thread)
 *                   | { type: "presence", agentsOnline } | { type: "error", message }
 */
export type SupportEvent =
  | { type: "message"; message: SupportMessage }
  | { type: "typing"; threadId: string; from: "USER" | "AGENT"; name?: string }
  | { type: "thread"; thread: SupportThread }
  | { type: "presence"; agentsOnline: number }
  | { type: "read"; threadId: string; by: "USER" | "AGENT" }
  | { type: "error"; message: string };

export type SupportCommand =
  | { type: "message"; threadId: string; body: string }
  | { type: "typing"; threadId: string }
  | { type: "read"; threadId: string }
  | { type: "subscribe"; threadId: string };

export function useSupportSocket({
  enabled = true,
  guestToken,
  onEvent,
}: {
  enabled?: boolean;
  guestToken?: string | null;
  onEvent: (e: SupportEvent) => void;
}) {
  const [status, setStatus] = React.useState<"idle" | "connecting" | "open" | "closed">("idle");
  const wsRef = React.useRef<WebSocket | null>(null);
  const handler = React.useRef(onEvent);
  handler.current = onEvent;
  const queue = React.useRef<SupportCommand[]>([]);

  React.useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const qs = guestToken ? `?guestToken=${encodeURIComponent(guestToken)}` : "";
      const ws = new WebSocket(`${proto}://${location.host}/api/v1/support/ws${qs}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
        for (const cmd of queue.current.splice(0)) ws.send(JSON.stringify(cmd));
        ping = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: "ping" })), 25_000);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (data?.type && data.type !== "pong") handler.current(data as SupportEvent);
        } catch {}
      };
      ws.onclose = () => {
        clearInterval(ping);
        setStatus("closed");
        if (stopped) return;
        // exponential backoff with jitter, max 15s
        const delay = Math.min(15_000, 500 * 2 ** attempt++) + Math.random() * 400;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [enabled, guestToken]);

  const send = React.useCallback((cmd: SupportCommand) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
    else queue.current.push(cmd);
  }, []);

  return { status, connected: status === "open", send };
}
