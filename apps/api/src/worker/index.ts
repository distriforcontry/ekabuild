import fs from "node:fs/promises";
import http from "node:http";
import pino from "pino";
import path from "node:path";
import amqp, { type Channel, type ConsumeMessage } from "amqplib";
import { env } from "../env";
import { prisma } from "../db";
import { DLX, EXCHANGE, MAX_ATTEMPTS, RETRY_EXCHANGE, assertTopology, publish, type BusEvent } from "../lib/bus";
import { runCadastreCheck } from "../lib/cadastre-check";
import { notify } from "../lib/notify";
import { redis } from "../lib/redis";
import { smsProvider } from "../lib/sms";
import { recalculateTrust } from "../lib/trust";
import { jobDuration, jobsProcessed, registry } from "../lib/metrics";

/**
 * EKA BUILD worker — consumes the RabbitMQ queues declared in lib/bus.ts.
 * Scale horizontally (worker-1, worker-2, …): prefetch keeps work fairly distributed,
 * failed messages are retried with exponential backoff and parked in *.dlq after MAX_ATTEMPTS.
 */

// structured JSON logs (collected by Loki/Promtail); pretty in development
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "worker", instance: env.INSTANCE_ID },
  formatters: { level: (label: string) => ({ level: label }) },
  ...(env.NODE_ENV === "production" ? {} : { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }),
});
const log = (msg: string, ...rest: unknown[]) => logger.info(rest.length ? { detail: rest } : {}, msg);

type Handler = (e: BusEvent<any>) => Promise<void>;

// ───────────────────────────── handlers ─────────────────────────────

const handlers: Record<string, Handler> = {
  "eka.sms": async (e) => {
    const { phone, message } = e.data as { phone: string; message: string };
    const r = await smsProvider.send(phone, message);
    if (!r.ok) throw new Error(`SMS failed: ${r.error}`);
  },

  "eka.notifications": async (e) => {
    const d = e.data as Record<string, any>;
    switch (e.type) {
      case "notification.created": {
        if (!d.sms) return;
        const n = await prisma.notification.findUnique({ where: { id: d.notificationId }, include: { user: { select: { phone: true } } } });
        if (n) await publish("sms.send", { phone: n.user.phone, message: `EKA BUILD: ${n.title}${n.body ? `. ${n.body}` : ""}`.slice(0, 300), kind: "notification" });
        return;
      }
      case "notification.welcome":
        await notify(d.userId, {
          type: "SUCCESS",
          title: "EKA BUILD ga xush kelibsiz!",
          body: "Obyektlarni ko'ring, hujjatlarni tekshiring va shartnomalarni E-IMZO bilan xavfsiz imzolang.",
          link: "/projects",
        });
        return;
      case "project.progress": {
        // fan-out: everyone who bought or follows the project hears about construction / post-handover news
        const [buyers, followers, project] = await Promise.all([
          prisma.purchase.findMany({ where: { projectId: d.projectId, status: { not: "CANCELLED" } }, select: { buyerId: true } }),
          prisma.favorite.findMany({ where: { projectId: d.projectId }, select: { userId: true } }),
          prisma.project.findUnique({ where: { id: d.projectId }, select: { name: true, slug: true } }),
        ]);
        const ids = new Set([...buyers.map((b) => b.buyerId), ...followers.map((f) => f.userId)]);
        for (const userId of ids)
          await notify(userId, {
            type: "INFO",
            title: d.phase === "POST_HANDOVER" ? `${project?.name}: topshirilgandan keyingi yangilik` : `${project?.name}: qurilish yangiligi`,
            body: d.title,
            link: `/projects/${project?.slug}#progress`,
          });
        return;
      }
      case "support.thread.created":
      case "project.org.pending":
      case "project.submitted": {
        const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "SUPERADMIN"] }, status: "ACTIVE" }, select: { id: true } });
        const map: Record<string, { title: string; link: string }> = {
          "support.thread.created": { title: "Yangi qo'llab-quvvatlash murojaati", link: "/admin/support" },
          "project.org.pending": { title: "Yangi tashkilot tasdiq kutmoqda", link: "/admin/organizations?status=PENDING" },
          "project.submitted": { title: "Obyekt moderatsiyaga yuborildi", link: "/admin/projects?verification=PENDING" },
        };
        const m = map[e.type]!;
        for (const a of admins) await notify(a.id, { type: "INFO", title: m.title, link: m.link });
        return;
      }
      default:
        return; // other events are informational for this queue
    }
  },

  "eka.trust": async (e) => {
    const projectId = (e.data as { projectId?: string | null })?.projectId;
    if (!projectId) return;
    // coalesce bursts of events for the same project across workers
    if (redis && redis.status === "ready") {
      const fresh = await redis.set(`trust:debounce:${projectId}`, "1", "PX", 1500, "NX");
      if (!fresh) return;
    }
    const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!exists) return;
    const r = await recalculateTrust(projectId);
    log("trust", projectId, "→", r.trustScore);
  },

  "eka.cadastre": async (e) => {
    const { projectId } = e.data as { projectId: string };
    const c = await runCadastreCheck(projectId, null);
    log("cadastre", projectId, c.result);
  },

  "eka.audit": async (e) => {
    // append-only off-database copy of the audit trail (one JSONL file per day)
    const dir = path.join(env.STORAGE_DIR, "_audit");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, `${e.at.slice(0, 10)}.jsonl`), JSON.stringify(e) + "\n");
  },
};

// ───────────────────────────── consumer plumbing ─────────────────────────────

async function consume(ch: Channel, queue: string, handler: Handler) {
  await ch.consume(queue, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    const attempts = Number(msg.properties.headers?.["x-attempts"] ?? 0);
    let event: BusEvent;
    try {
      event = JSON.parse(msg.content.toString());
    } catch {
      ch.nack(msg, false, false); // poison message → DLQ
      return;
    }
    const stop = jobDuration.startTimer({ queue });
    try {
      await handler(event);
      ch.ack(msg);
      jobsProcessed.inc({ queue, outcome: "ok" });
      stop();
    } catch (err) {
      stop();
      if (attempts + 1 >= MAX_ATTEMPTS) {
        logger.error({ queue, type: event.type, err: (err as Error).message, attempts: attempts + 1 }, "job failed permanently → DLQ");
        jobsProcessed.inc({ queue, outcome: "dead_lettered" });
        ch.nack(msg, false, false); // dead-letter → <queue>.dlq
      } else {
        const delay = Math.min(60_000, 1000 * 2 ** attempts);
        logger.warn({ queue, type: event.type, err: (err as Error).message, retry: attempts + 1, delayMs: delay }, "job failed, scheduling retry");
        jobsProcessed.inc({ queue, outcome: "retried" });
        ch.publish(RETRY_EXCHANGE, queue, msg.content, {
          persistent: true,
          contentType: "application/json",
          expiration: String(delay),
          headers: { ...msg.properties.headers, "x-attempts": attempts + 1 },
        });
        ch.ack(msg);
      }
    }
  });
}

// ───────────────────────────── scheduled jobs (leader-elected via Redis) ─────────────────────────────

async function withLock(name: string, ttlSec: number, fn: () => Promise<void>) {
  if (redis && redis.status === "ready") {
    const ok = await redis.set(`lock:${name}`, env.INSTANCE_ID, "EX", ttlSec, "NX");
    if (!ok) return;
  }
  try {
    await fn();
  } catch (e) {
    log(`job ${name} failed:`, (e as Error).message);
  }
}

async function expireCertificates() {
  await withLock("cert-expiry", 50 * 60, async () => {
    const now = new Date();
    const expired = await prisma.certificate.findMany({ where: { status: "VERIFIED", validUntil: { lt: now } }, select: { id: true, projectId: true } });
    if (expired.length) {
      await prisma.certificate.updateMany({ where: { id: { in: expired.map((c) => c.id) } }, data: { status: "EXPIRED" } });
      for (const c of expired) await publish("trust.recalculate", { projectId: c.projectId });
      log(`expired ${expired.length} certificates`);
    }
    // warn developers 30 days ahead (once a day per certificate)
    const soon = await prisma.certificate.findMany({
      where: { status: "VERIFIED", validUntil: { gte: now, lt: new Date(now.getTime() + 30 * 86400_000) } },
      include: { project: { select: { developerId: true, name: true, id: true } } },
    });
    for (const c of soon) {
      if (redis && redis.status === "ready" && !(await redis.set(`warn:cert:${c.id}`, "1", "EX", 86400, "NX"))) continue;
      const members = await prisma.user.findMany({ where: { organizationId: c.project.developerId }, select: { id: true } });
      for (const m of members)
        await notify(m.id, {
          type: "WARNING",
          title: "Sertifikat muddati tugamoqda",
          body: `${c.project.name}: ${c.number} — ${c.validUntil!.toISOString().slice(0, 10)}`,
          link: `/app/developer/projects/${c.project.id}`,
        });
    }
  });
}

// ───────────────────────────── main ─────────────────────────────

function startMetricsServer() {
  const port = Number(process.env.WORKER_METRICS_PORT ?? 9100);
  http
    .createServer(async (req, res) => {
      if (req.url === "/metrics") {
        res.setHeader("content-type", registry.contentType);
        res.end(await registry.metrics());
      } else if (req.url === "/health") res.end("ok");
      else res.writeHead(404).end();
    })
    .listen(port, () => log(`metrics on :${port}/metrics`));
}

async function main() {
  process.env.SERVICE_NAME ??= "worker";
  startMetricsServer();
  if (!env.RABBITMQ_URL) {
    log("RABBITMQ_URL is not set — nothing to do");
    return;
  }
  for (;;) {
    try {
      const conn = await amqp.connect(env.RABBITMQ_URL, { clientProperties: { connection_name: `worker:${env.INSTANCE_ID}` } });
      const ch = await conn.createChannel();
      await assertTopology(ch);
      await ch.prefetch(Number(process.env.WORKER_PREFETCH ?? 10));
      for (const [queue, handler] of Object.entries(handlers)) await consume(ch, queue, handler);
      log(`consuming ${Object.keys(handlers).join(", ")} (exchange ${EXCHANGE}, dlx ${DLX})`);

      const timer = setInterval(() => void expireCertificates(), 60 * 60 * 1000);
      void expireCertificates();

      await new Promise<void>((resolve) => {
        conn.on("close", () => resolve());
        conn.on("error", () => {});
        const stop = async () => {
          clearInterval(timer);
          await ch.close().catch(() => {});
          await conn.close().catch(() => {});
          await prisma.$disconnect();
          process.exit(0);
        };
        process.once("SIGTERM", stop);
        process.once("SIGINT", stop);
      });
      clearInterval(timer);
      log("connection closed, reconnecting…");
    } catch (e) {
      log("RabbitMQ unavailable:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

void main();
