import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { env, isProd } from "./env";
import { prisma } from "./db";
import { AppError } from "./lib/errors";
import { redis } from "./lib/redis";
import { busStatus } from "./lib/bus";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import developerRoutes from "./routes/developer";
import buyerRoutes from "./routes/buyer";
import inspectionRoutes from "./routes/inspection";
import adminRoutes from "./routes/admin";
import supportRoutes from "./routes/support";

const startedAt = Date.now();

export async function buildServer() {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 2 * 1024 * 1024,
    logger: isProd
      ? { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] }
      : { level: "info", transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } },
    genReqId: (req) => (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } });
  await app.register(cors, {
    origin: (origin, cb) => {
      // same-origin via nginx needs no CORS; allow our own subdomains for direct api.ekabuild.uz use
      if (!origin) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        const base = new URL(env.PUBLIC_URL).hostname;
        cb(null, host === base || host.endsWith(`.${base}`) || host === "localhost");
      } catch {
        cb(null, false);
      }
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    // shared limiter across replicas when Redis is available
    ...(redis ? { redis, nameSpace: "eka-rl:" } : {}),
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: { code: "TOO_MANY", message: `Juda ko'p so'rov. ${Math.ceil(ctx.ttl / 1000)} soniyadan so'ng urinib ko'ring` },
    }),
  });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });
  await app.register(authPlugin);

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({
        error: { code: "VALIDATION", message: first ? `${first.path.join(".") || "body"}: ${first.message}` : "Validation error", details: err.issues },
      });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return reply.code(409).send({ error: { code: "DUPLICATE", message: "Bunday yozuv allaqachon mavjud", details: err.meta } });
      if (err.code === "P2025") return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Topilmadi" } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    const e = err as FastifyError & { error?: { code: string; message: string } };
    if (status === 429 && e.error) return reply.code(429).send({ error: e.error });
    return reply.code(status).send({ error: { code: (err as FastifyError).code ?? "INTERNAL", message: status >= 500 && isProd ? "Server xatosi" : err.message } });
  });

  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.url} not found` } }));

  const health = async () => {
    let db = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    return {
      status: db === "up" ? "ok" : "degraded",
      instance: env.INSTANCE_ID,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      db,
      redis: redis ? redis.status : "disabled",
      rabbitmq: busStatus(),
    };
  };
  app.get("/health", health);
  // echo the serving replica so load balancing is observable
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-served-by", env.INSTANCE_ID);
  });

  await app.register(
    async (api) => {
      api.get("/health", health);
      await api.register(authRoutes);
      await api.register(publicRoutes);
      await api.register(developerRoutes);
      await api.register(buyerRoutes);
      await api.register(inspectionRoutes);
      await api.register(supportRoutes);
      await api.register(adminRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
