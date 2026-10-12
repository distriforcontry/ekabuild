import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { env } from "../env";
import { busPublished } from "./metrics";

/**
 * RabbitMQ event bus.
 *
 * Topology (declared idempotently by both API and worker):
 *   exchange  eka.events   (topic, durable)     ← API publishes domain events here
 *   exchange  eka.retry    (direct, durable)    → per-queue retry queues with TTL, dead-lettered back to the work queue
 *   exchange  eka.dlx      (direct, durable)    → *.dlq parking queues after MAX_ATTEMPTS
 *
 *   queue                bindings (routing keys on eka.events)
 *   eka.notifications    notification.#  purchase.#  contract.#  certificate.#  project.#  support.thread.created
 *   eka.sms              sms.send
 *   eka.trust            trust.recalculate  certificate.#  inspection.#  cadastre.#  document.#  complaint.#
 *   eka.cadastre         cadastre.check
 *   eka.audit            audit.#
 */

export const EXCHANGE = "eka.events";
export const RETRY_EXCHANGE = "eka.retry";
export const DLX = "eka.dlx";
export const MAX_ATTEMPTS = 5;

export const QUEUES: Record<string, string[]> = {
  "eka.notifications": ["notification.#", "purchase.#", "contract.#", "certificate.#", "project.#", "support.thread.created"],
  "eka.sms": ["sms.send"],
  "eka.trust": ["trust.recalculate", "certificate.#", "inspection.#", "cadastre.#", "document.#", "complaint.#"],
  "eka.cadastre": ["cadastre.check"],
  "eka.audit": ["audit.#"],
};

export async function assertTopology(ch: ConfirmChannel | amqp.Channel) {
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  await ch.assertExchange(RETRY_EXCHANGE, "direct", { durable: true });
  await ch.assertExchange(DLX, "direct", { durable: true });
  for (const [queue, keys] of Object.entries(QUEUES)) {
    await ch.assertQueue(queue, { durable: true, arguments: { "x-dead-letter-exchange": DLX, "x-dead-letter-routing-key": queue } });
    for (const k of keys) await ch.bindQueue(queue, EXCHANGE, k);
    // direct route used for retries / targeted re-delivery
    await ch.bindQueue(queue, EXCHANGE, `direct.${queue}`);
    // retry queue: messages wait TTL (per-message expiration) then return to the work queue
    await ch.assertQueue(`${queue}.retry`, {
      durable: true,
      arguments: { "x-dead-letter-exchange": EXCHANGE, "x-dead-letter-routing-key": `direct.${queue}` },
    });
    await ch.bindQueue(`${queue}.retry`, RETRY_EXCHANGE, queue);
    await ch.assertQueue(`${queue}.dlq`, { durable: true });
    await ch.bindQueue(`${queue}.dlq`, DLX, queue);
  }
}

let conn: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;
let connecting: Promise<ConfirmChannel | null> | null = null;
const pending: { key: string; payload: unknown }[] = [];

async function connect(): Promise<ConfirmChannel | null> {
  if (!env.RABBITMQ_URL) return null;
  if (channel) return channel;
  connecting ??= (async () => {
    try {
      conn = await amqp.connect(env.RABBITMQ_URL, { clientProperties: { connection_name: `api:${env.INSTANCE_ID}` } });
      conn.on("close", () => {
        conn = null;
        channel = null;
        setTimeout(() => void connect(), 3000);
      });
      conn.on("error", () => {});
      const ch = await conn.createConfirmChannel();
      await assertTopology(ch);
      channel = ch;
      // flush messages buffered while disconnected
      for (const m of pending.splice(0)) await publish(m.key, m.payload);
      return ch;
    } catch (e) {
      console.warn("[bus] RabbitMQ unavailable:", (e as Error).message);
      setTimeout(() => void connect(), 5000);
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export type BusEvent<T = unknown> = { id: string; type: string; at: string; source: string; data: T };

/** Publish a domain event. Never throws: buffers (bounded) while the broker is down. */
export async function publish<T>(routingKey: string, data: T): Promise<void> {
  const ch = channel ?? (await connect());
  const event: BusEvent<T> = { id: crypto.randomUUID(), type: routingKey, at: new Date().toISOString(), source: env.INSTANCE_ID, data };
  if (!ch) {
    if (pending.length < 5000) pending.push({ key: routingKey, payload: data });
    return;
  }
  try {
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: "application/json",
      messageId: event.id,
      timestamp: Date.now(),
      type: routingKey,
    });
    await ch.waitForConfirms();
    busPublished.inc({ routing_key: routingKey.split(".").slice(0, 2).join("."), result: "ok" });
  } catch (e) {
    busPublished.inc({ routing_key: routingKey.split(".").slice(0, 2).join("."), result: "error" });
    console.warn("[bus] publish failed:", (e as Error).message);
    if (pending.length < 5000) pending.push({ key: routingKey, payload: data });
  }
}

export async function initBus() {
  await connect();
}

export async function closeBus() {
  try {
    await channel?.close();
    await conn?.close();
  } catch {}
}

export const busStatus = () => (channel ? "up" : env.RABBITMQ_URL ? "down" : "disabled");
