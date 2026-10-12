import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma, SupportSender } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { randomToken, sha256 } from "../lib/auth";
import { publish } from "../lib/bus";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { paginate, supportMessageDto, supportThreadDto, supportThreadInclude } from "../lib/serializers";
import { addConn, agentsOnline, broadcast, removeConn, type Conn } from "../realtime/support-hub";
import { isAdminRole, requireRole } from "../plugins/auth";

const bodySchema = z.string().trim().min(1).max(4000);
const isAgentRole = (r?: string | null) => isAdminRole(r as never);

async function threadDto(id: string) {
  const t = await prisma.supportThread.findUniqueOrThrow({ where: { id }, include: supportThreadInclude });
  return supportThreadDto(t);
}

const messageInclude = { sender: { select: { id: true, fullName: true } } } satisfies Prisma.SupportMessageInclude;

/** Single write path for chat messages (REST and WebSocket). */
async function postMessage(threadId: string, side: SupportSender, senderId: string | null, body: string) {
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) throw notFound("Suhbat topilmadi");
  const msg = await prisma.supportMessage.create({ data: { threadId, senderType: side, senderId, body }, include: messageInclude });
  await prisma.supportThread.update({
    where: { id: threadId },
    data:
      side === "AGENT"
        ? {
            lastMessageAt: msg.createdAt,
            unreadForUser: { increment: 1 },
            status: thread.status === "CLOSED" ? "OPEN" : thread.status,
            firstResponseAt: thread.firstResponseAt ?? msg.createdAt,
            assignedToId: thread.assignedToId ?? senderId,
          }
        : { lastMessageAt: msg.createdAt, unreadForAgent: { increment: 1 }, status: "OPEN", closedAt: null },
  });
  const dto = supportMessageDto(msg);
  const t = await threadDto(threadId);
  const to = { agents: true, ownerUserId: thread.userId, threadId };
  broadcast(to, { type: "message", message: dto });
  broadcast({ ...to, excludeSide: "USER" }, { type: "thread", thread: t });
  return { message: dto, thread: t };
}

async function resolveGuest(req: FastifyRequest): Promise<string | null> {
  const token = (req.headers["x-guest-token"] as string | undefined) ?? (req.query as { guestToken?: string })?.guestToken;
  if (!token) return null;
  const t = await prisma.supportThread.findUnique({ where: { guestTokenHash: sha256(token) }, select: { id: true } });
  return t?.id ?? null;
}

/** May the caller read/write this thread? returns the side they act as */
async function sideFor(req: FastifyRequest, threadId: string): Promise<SupportSender> {
  if (req.user && isAgentRole(req.user.role)) return "AGENT";
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId }, select: { userId: true } });
  if (!thread) throw notFound("Suhbat topilmadi");
  if (req.user && thread.userId === req.user.id) return "USER";
  if ((await resolveGuest(req)) === threadId) return "USER";
  throw forbidden();
}

export default async function supportRoutes(app: FastifyInstance) {
  app.post("/support/threads", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (req) => {
    const b = z
      .object({ body: bodySchema, subject: z.string().max(255).optional(), guestName: z.string().trim().max(128).optional(), guestPhone: z.string().trim().max(32).optional() })
      .parse(req.body);
    let guestToken: string | undefined;
    let threadId: string;

    if (req.user) {
      const open = await prisma.supportThread.findFirst({ where: { userId: req.user.id, status: { not: "CLOSED" } }, orderBy: { lastMessageAt: "desc" } });
      threadId = open?.id ?? (await prisma.supportThread.create({ data: { userId: req.user.id, subject: b.subject } })).id;
    } else {
      if (!b.guestName && !b.guestPhone) throw badRequest("Ism yoki telefon raqamingizni kiriting");
      guestToken = randomToken(24);
      threadId = (
        await prisma.supportThread.create({ data: { guestName: b.guestName, guestPhone: b.guestPhone, subject: b.subject, guestTokenHash: sha256(guestToken) } })
      ).id;
    }
    await postMessage(threadId, "USER", req.user?.id ?? null, b.body);
    void publish("support.thread.created", { threadId });
    const messages = await prisma.supportMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" }, include: messageInclude });
    return { thread: await threadDto(threadId), messages: messages.map(supportMessageDto), ...(guestToken ? { guestToken } : {}) };
  });

  app.get("/support/threads/mine", async (req) => {
    let threadId: string | null = null;
    if (req.user) {
      const t = await prisma.supportThread.findFirst({ where: { userId: req.user.id }, orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }], select: { id: true } });
      threadId = t?.id ?? null;
    } else threadId = await resolveGuest(req);
    if (!threadId) return { thread: null, messages: [] };
    await prisma.supportThread.update({ where: { id: threadId }, data: { unreadForUser: 0 } });
    const messages = await prisma.supportMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" }, take: 500, include: messageInclude });
    return { thread: await threadDto(threadId), messages: messages.map(supportMessageDto), agentsOnline: await agentsOnline() };
  });

  app.post<{ Params: { id: string } }>("/support/threads/:id/messages", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const side = await sideFor(req, req.params.id);
    const { body } = z.object({ body: bodySchema }).parse(req.body);
    return (await postMessage(req.params.id, side, req.user?.id ?? null, body)).message;
  });

  // ── agents
  app.get("/admin/support/threads", async (req) => {
    requireRole(req, "ADMIN");
    const q = z.object({ status: z.enum(["OPEN", "PENDING", "CLOSED"]).optional(), q: z.string().optional(), page: z.coerce.number().optional(), pageSize: z.coerce.number().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate({ ...q, pageSize: q.pageSize ?? 30 });
    const where: Prisma.SupportThreadWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q
        ? { OR: [{ guestName: { contains: q.q } }, { guestPhone: { contains: q.q } }, { user: { fullName: { contains: q.q } } }, { user: { phone: { contains: q.q } } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.supportThread.findMany({ where, skip, take, include: supportThreadInclude, orderBy: { lastMessageAt: "desc" } }),
      prisma.supportThread.count({ where }),
    ]);
    return { items: rows.map(supportThreadDto), total, page, pageSize };
  });

  app.get<{ Params: { id: string } }>("/admin/support/threads/:id", async (req) => {
    requireRole(req, "ADMIN");
    const exists = await prisma.supportThread.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw notFound();
    await prisma.supportThread.update({ where: { id: req.params.id }, data: { unreadForAgent: 0 } });
    const messages = await prisma.supportMessage.findMany({ where: { threadId: req.params.id }, orderBy: { createdAt: "asc" }, include: messageInclude });
    return { thread: await threadDto(req.params.id), messages: messages.map(supportMessageDto) };
  });

  app.patch<{ Params: { id: string } }>("/admin/support/threads/:id", async (req) => {
    const u = requireRole(req, "ADMIN");
    const b = z.object({ status: z.enum(["OPEN", "PENDING", "CLOSED"]).optional(), assignedToId: z.string().nullable().optional() }).parse(req.body);
    const t = await prisma.supportThread.update({
      where: { id: req.params.id },
      data: { ...b, ...(b.status === "CLOSED" ? { closedAt: new Date() } : b.status ? { closedAt: null } : {}) },
    });
    if (b.status === "CLOSED") await postMessage(t.id, "SYSTEM", u.id, "Suhbat yakunlandi. Murojaatingiz uchun rahmat!");
    const dto = await threadDto(t.id);
    broadcast({ agents: true, ownerUserId: t.userId, threadId: t.id }, { type: "thread", thread: dto });
    return dto;
  });

  app.get("/admin/support/stats", async (req) => {
    requireRole(req, "ADMIN");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [open, pending, closedToday, responded] = await Promise.all([
      prisma.supportThread.count({ where: { status: "OPEN" } }),
      prisma.supportThread.count({ where: { status: "PENDING" } }),
      prisma.supportThread.count({ where: { status: "CLOSED", closedAt: { gte: startOfDay } } }),
      prisma.supportThread.findMany({ where: { firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    const avg = responded.length ? responded.reduce((s, t) => s + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / responded.length / 60000 : 0;
    return { open, pending, closedToday, agentsOnline: await agentsOnline(), avgFirstResponseMin: Math.round(avg * 10) / 10 };
  });

  // ── WebSocket
  app.get("/support/ws", { websocket: true }, async (socket, req) => {
    const guestThread = req.user ? null : await resolveGuest(req);
    if (!req.user && !guestThread) {
      socket.send(JSON.stringify({ type: "error", message: "unauthorized" }));
      socket.close(4401, "unauthorized");
      return;
    }
    const agent = !!req.user && isAgentRole(req.user.role);
    const name = req.user ? ((await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } }))?.fullName ?? null) : null;
    const conn: Conn = { ws: socket, kind: agent ? "agent" : req.user ? "user" : "guest", userId: req.user?.id ?? null, threadId: guestThread, name };
    addConn(conn);
    socket.send(JSON.stringify({ type: "presence", agentsOnline: await agentsOnline() }));

    // simple per-socket flood control
    let tokens = 20;
    const refill = setInterval(() => (tokens = Math.min(20, tokens + 2)), 1000);

    socket.on("message", async (raw: Buffer) => {
      if (--tokens < 0) return;
      let msg: { type?: string; threadId?: string; body?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      try {
        if (msg.type === "ping") return socket.send(JSON.stringify({ type: "pong" }));
        if (!msg.threadId) return;
        // authorise against the thread
        let side: SupportSender;
        if (agent) side = "AGENT";
        else {
          const t = await prisma.supportThread.findUnique({ where: { id: msg.threadId }, select: { userId: true } });
          if (!t || (conn.kind === "user" ? t.userId !== conn.userId : conn.threadId !== msg.threadId)) return;
          side = "USER";
        }
        const t = await prisma.supportThread.findUnique({ where: { id: msg.threadId }, select: { userId: true } });
        const to = { agents: true, ownerUserId: t?.userId ?? null, threadId: msg.threadId };

        if (msg.type === "message") {
          const body = bodySchema.safeParse(msg.body);
          if (!body.success) return;
          await postMessage(msg.threadId, side, conn.userId, body.data);
        } else if (msg.type === "typing") {
          broadcast({ ...to, excludeSide: side }, { type: "typing", threadId: msg.threadId, from: side, name: side === "AGENT" ? conn.name : undefined });
        } else if (msg.type === "read") {
          await prisma.supportThread.update({ where: { id: msg.threadId }, data: side === "AGENT" ? { unreadForAgent: 0 } : { unreadForUser: 0 } });
          broadcast({ ...to, excludeSide: side }, { type: "read", threadId: msg.threadId, by: side });
        }
      } catch (e) {
        socket.send(JSON.stringify({ type: "error", message: (e as Error).message }));
      }
    });

    socket.on("close", () => {
      clearInterval(refill);
      removeConn(conn);
    });
  });
}
