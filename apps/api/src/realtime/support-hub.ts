import type { WebSocket } from "ws";
import { env } from "../env";
import { createSubscriber, redis } from "../lib/redis";
import { wsConnections } from "../lib/metrics";

/**
 * Real-time support hub.
 * Every API replica keeps its own sockets; events are fanned out to all replicas through Redis pub/sub,
 * so a visitor connected to api-1 and an agent connected to api-2 still talk in real time.
 */

export type Conn = {
  ws: WebSocket;
  kind: "user" | "guest" | "agent";
  userId: string | null;
  /** guest sockets are bound to exactly one thread */
  threadId: string | null;
  name: string | null;
};

type Envelope = {
  origin: string;
  /** who should receive it */
  to: { agents: boolean; ownerUserId: string | null; threadId: string; excludeSide?: "USER" | "AGENT" };
  event: unknown;
};

const CHANNEL = "eka:support";
const conns = new Set<Conn>();
let sub: ReturnType<typeof createSubscriber> = null;

function deliverLocal(env_: Envelope) {
  const data = JSON.stringify(env_.event);
  for (const c of conns) {
    if (c.ws.readyState !== 1) continue;
    const isAgent = c.kind === "agent";
    if (env_.to.excludeSide === "AGENT" && isAgent) continue;
    if (env_.to.excludeSide === "USER" && !isAgent) continue;
    const isOwner =
      (c.kind === "user" && !!env_.to.ownerUserId && c.userId === env_.to.ownerUserId) || (c.kind === "guest" && c.threadId === env_.to.threadId);
    if ((isAgent && env_.to.agents) || isOwner) c.ws.send(data);
  }
}

export async function initSupportHub() {
  sub = createSubscriber();
  if (!sub) return;
  await sub.subscribe(CHANNEL);
  sub.on("message", (_ch, raw) => {
    try {
      deliverLocal(JSON.parse(raw) as Envelope);
    } catch {}
  });
  // presence heartbeat: each replica reports how many agents it holds
  setInterval(() => void reportPresence(), 20_000).unref();
}

/** Broadcast an event to the thread owner and/or all agents across the cluster. */
export function broadcast(to: Envelope["to"], event: unknown) {
  const e: Envelope = { origin: env.INSTANCE_ID, to, event };
  if (redis && redis.status === "ready") {
    redis.publish(CHANNEL, JSON.stringify(e)).catch(() => deliverLocal(e));
  } else deliverLocal(e);
}

export function addConn(c: Conn) {
  conns.add(c);
  wsConnections.inc({ kind: c.kind });
  if (c.kind === "agent") void reportPresence(true);
}

export function removeConn(c: Conn) {
  if (conns.delete(c)) wsConnections.dec({ kind: c.kind });
  if (c.kind === "agent") void reportPresence(true);
}

const presenceKey = () => `eka:support:agents:${env.INSTANCE_ID}`;

async function reportPresence(announce = false) {
  const local = [...conns].filter((c) => c.kind === "agent").length;
  if (redis && redis.status === "ready") await redis.set(presenceKey(), String(local), "EX", 60).catch(() => {});
  if (announce) {
    const total = await agentsOnline();
    broadcast({ agents: true, ownerUserId: null, threadId: "*" }, { type: "presence", agentsOnline: total });
    // visitors also get presence (online / offline dot)
    for (const c of conns) if (c.kind !== "agent" && c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "presence", agentsOnline: total }));
  }
}

export async function agentsOnline(): Promise<number> {
  if (!redis || redis.status !== "ready") return [...conns].filter((c) => c.kind === "agent").length;
  try {
    const keys = await redis.keys("eka:support:agents:*");
    if (!keys.length) return 0;
    const vals = await redis.mget(...keys);
    return vals.reduce((s, v) => s + Number(v ?? 0), 0);
  } catch {
    return 0;
  }
}

export async function closeSupportHub() {
  for (const c of conns) c.ws.close(1001, "server shutdown");
  await sub?.quit().catch(() => {});
  if (redis && redis.status === "ready") await redis.del(presenceKey()).catch(() => {});
}
