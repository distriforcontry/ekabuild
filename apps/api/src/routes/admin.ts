import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { audit, verifyAuditChain } from "../lib/audit";
import fs from "node:fs/promises";
import { busStatus, publish, queueStats } from "../lib/bus";
import { env } from "../env";
import { slugify } from "../lib/codes";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { notifyOrgMembers, notify } from "../lib/notify";
import { invalidate, redis } from "../lib/redis";
import { certificateDto, documentDto, orgDto, paginate, projectCard, projectCardInclude, purchaseDto, purchaseInclude, userDto, userSelect } from "../lib/serializers";
import { recalculateTrust } from "../lib/trust";
import { requireRole } from "../plugins/auth";
import { archivedFilter } from "./control";

const pageQuery = z
  .object({
    page: z.coerce.number().optional(),
    pageSize: z.coerce.number().optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.string().max(40).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    /** absent → active only, "1" → archived only, "all" → both */
    archived: z.string().max(5).optional(),
  })
  .passthrough();

/** `sort=<field>&order=asc|desc` → Prisma orderBy, restricted to a whitelist (falls back to the default order). */
function orderBy<T>(q: { sort?: string; order?: "asc" | "desc" }, allowed: string[], fallback: T): T {
  if (!q.sort || !allowed.includes(q.sort)) return fallback;
  return { [q.sort]: q.order ?? "asc" } as T;
}

export default async function adminRoutes(app: FastifyInstance) {
  // every /admin route requires ADMIN (SUPERADMIN passes automatically)
  app.addHook("preHandler", async (req) => {
    if (req.url.includes("/admin/")) requireRole(req, "ADMIN");
  });

  // ── deep health for the admin "system map": every dependency with latency, queues, workers, integration modes
  app.get("/admin/system/health", async () => {
    const timed = async <T>(fn: () => Promise<T>) => {
      const t = performance.now();
      try {
        const value = await fn();
        return { ok: true, ms: Math.round((performance.now() - t) * 10) / 10, value };
      } catch (e) {
        return { ok: false, ms: Math.round((performance.now() - t) * 10) / 10, error: (e as Error).message.slice(0, 160) };
      }
    };
    const [db, cache, queues, storage] = await Promise.all([
      timed(() => prisma.$queryRaw`SELECT 1`),
      timed(async () => {
        if (!redis) throw new Error("REDIS_URL not set");
        return redis.ping();
      }),
      timed(async () => queueStats()),
      timed(async () => {
        if (env.STORAGE_DRIVER !== "local") return { driver: env.STORAGE_DRIVER };
        await fs.access(env.STORAGE_DIR, fs.constants.W_OK);
        const st = await fs.statfs(env.STORAGE_DIR);
        return { driver: "local", freeBytes: st.bavail * st.bsize, totalBytes: st.blocks * st.bsize };
      }),
    ]);
    const q = queues.ok ? (queues as { value: Awaited<ReturnType<typeof queueStats>> }).value : null;
    // every worker replica consumes every queue → the smallest consumer count is the number of live workers
    const workers = q && q.length ? Math.min(...q.map((x) => x.consumers)) : 0;
    const mem = process.memoryUsage();
    return {
      instance: env.INSTANCE_ID,
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      memory: { rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576) },
      checks: {
        mysql: { ok: db.ok, ms: db.ms, error: "error" in db ? db.error : undefined },
        redis: { ok: cache.ok, ms: cache.ms, error: "error" in cache ? cache.error : undefined },
        rabbitmq: { ok: busStatus() === "up", status: busStatus(), ms: queues.ms },
        workers: { ok: workers > 0, count: workers },
        storage: { ok: storage.ok, ...(storage.ok ? (storage as { value: object }).value : { error: (storage as { error: string }).error }) },
        sms: { ok: true, provider: env.SMS_PROVIDER, mock: env.SMS_PROVIDER === "mock" },
        eimzo: { ok: true, mode: env.EIMZO_MODE, mock: env.EIMZO_MODE === "mock" },
        cadastre: { ok: true, provider: env.CADASTRE_PROVIDER, mock: env.CADASTRE_PROVIDER === "mock" },
      },
      queues: q ?? [],
    };
  });

  app.get("/admin/stats", async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 11, 1);
    since.setHours(0, 0, 0, 0);

    const [users, organizations, projects, purchases, revenue, openComplaints, pendingOrgs, pendingProjects, pendingCertificates, pendingDocuments] =
      await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.project.count(),
        prisma.purchase.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.purchase.aggregate({ where: { status: { in: ["PAID", "COMPLETED"] } }, _sum: { amount: true } }),
        prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
        prisma.organization.count({ where: { status: "PENDING" } }),
        prisma.project.count({ where: { verificationStatus: "PENDING" } }),
        prisma.certificate.count({ where: { status: "PENDING" } }),
        prisma.document.count({ where: { status: "PENDING" } }),
      ]);

    const monthly = await prisma.$queryRaw<{ month: string; count: bigint; amount: string | null }[]>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count, SUM(amount) AS amount
      FROM Purchase WHERE createdAt >= ${since} AND status <> 'CANCELLED'
      GROUP BY month ORDER BY month`;
    const byMonth = new Map(monthly.map((m) => [m.month, m]));
    const purchasesByMonth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = byMonth.get(key);
      return { month: key, count: Number(m?.count ?? 0), amount: Number(m?.amount ?? 0) };
    });

    const [statusGroups, regionGroups, trustRows, recentAudit, openSupport] = await Promise.all([
      prisma.project.groupBy({ by: ["status"], _count: true }),
      prisma.project.groupBy({ by: ["region"], _count: true, orderBy: { _count: { region: "desc" } }, take: 14 }),
      prisma.project.findMany({ select: { trustScore: true } }),
      prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 10, include: { actor: { select: { fullName: true, phone: true } } } }),
      prisma.supportThread.count({ where: { status: "OPEN" } }),
    ]);
    const buckets = ["0-39", "40-64", "65-84", "85-100"];
    const trustDistribution = buckets.map((bucket) => {
      const [lo, hi] = bucket.split("-").map(Number) as [number, number];
      return { bucket, count: trustRows.filter((r) => r.trustScore >= lo && r.trustScore <= hi).length };
    });

    return {
      kpi: {
        users,
        organizations,
        projects,
        purchases,
        revenue: revenue._sum.amount?.toFixed(2) ?? "0.00",
        openComplaints,
        pendingOrgs,
        pendingProjects,
        pendingCertificates,
        pendingDocuments,
        openSupport,
      },
      purchasesByMonth,
      projectsByStatus: statusGroups.map((g) => ({ status: g.status, count: g._count })),
      projectsByRegion: regionGroups.map((g) => ({ region: g.region, count: g._count })),
      trustDistribution,
      recentAudit: recentAudit.map(auditDto),
    };
  });

  // ── organizations
  app.get("/admin/organizations", async (req) => {
    const q = pageQuery.extend({ status: z.string().optional(), type: z.string().optional(), blocked: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.OrganizationWhereInput = {
      ...archivedFilter(q.archived),
      ...(q.blocked === "1" ? { blockedAt: { not: null } } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.type ? { type: q.type as never } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { tin: { contains: q.q } }, { director: { contains: q.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.organization.findMany({ where, skip, take, orderBy: orderBy(q, ["name", "tin", "status", "type", "createdAt", "region"], [{ status: "asc" }, { createdAt: "desc" }] as Prisma.OrganizationOrderByWithRelationInput[]), include: { _count: { select: { members: true, projects: true } } } }),
      prisma.organization.count({ where }),
    ]);
    return { items: rows.map((o) => ({ ...orgDto(o), membersCount: o._count.members, projectsCount: o._count.projects })), total, page, pageSize };
  });

  app.patch<{ Params: { id: string } }>("/admin/organizations/:id", async (req) => {
    const body = z.object({ status: z.enum(["PENDING", "VERIFIED", "REJECTED"]), rejectReason: z.string().max(512).nullable().optional() }).parse(req.body);
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { status: body.status, rejectReason: body.status === "REJECTED" ? (body.rejectReason ?? null) : null, verifiedAt: body.status === "VERIFIED" ? new Date() : null },
    });
    void audit({ actorId: req.user!.id, action: `ORG_${body.status}`, entity: "Organization", entityId: org.id, ip: req.ip, meta: { tin: org.tin, reason: body.rejectReason } });
    void notifyOrgMembers(org.id, {
      type: body.status === "VERIFIED" ? "SUCCESS" : body.status === "REJECTED" ? "DANGER" : "INFO",
      title: body.status === "VERIFIED" ? "Tashkilotingiz tasdiqlandi" : body.status === "REJECTED" ? "Tashkilot rad etildi" : "Tashkilot qayta tekshiruvda",
      body: body.rejectReason ?? undefined,
      sms: true,
    });
    const projects = await prisma.project.findMany({ where: { developerId: org.id }, select: { id: true } });
    for (const p of projects) void publish("trust.recalculate", { projectId: p.id });
    return orgDto(org);
  });

  // ── projects
  app.get("/admin/projects", async (req) => {
    const q = pageQuery.extend({ verification: z.string().optional(), status: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.ProjectWhereInput = {
      ...archivedFilter(q.archived),
      ...(q.verification ? { verificationStatus: q.verification as never } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { address: { contains: q.q } }, { developer: { name: { contains: q.q } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take, include: projectCardInclude, orderBy: orderBy(q, ["name", "status", "trustScore", "progress", "createdAt", "region", "verificationStatus"], { updatedAt: "desc" } as Prisma.ProjectOrderByWithRelationInput) }),
      prisma.project.count({ where }),
    ]);
    return { items: rows.map(projectCard), total, page, pageSize };
  });

  app.patch<{ Params: { id: string } }>("/admin/projects/:id", async (req) => {
    const body = z
      .object({
        verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
        published: z.boolean().optional(),
        featured: z.boolean().optional(),
        status: z.enum(["PLANNING", "PERMITTED", "UNDER_CONSTRUCTION", "COMPLETED", "COMMISSIONED", "SUSPENDED"]).optional(),
      })
      .parse(req.body);
    const before = await prisma.project.findUnique({ where: { id: req.params.id }, include: { developer: true } });
    if (!before) throw notFound();
    if (body.published && before.developer.status !== "VERIFIED") throw badRequest("Quruvchi tasdiqlanmagan — obyektni e'lon qilib bo'lmaydi", "DEVELOPER_NOT_VERIFIED");
    const p = await prisma.project.update({ where: { id: before.id }, data: body, include: projectCardInclude });
    void audit({ actorId: req.user!.id, action: "PROJECT_MODERATE", entity: "Project", entityId: p.id, ip: req.ip, meta: body });
    void publish("trust.recalculate", { projectId: p.id });
    await invalidate("projects:map", "stats:public");
    if (body.verificationStatus || body.published !== undefined) {
      void notifyOrgMembers(p.developerId, {
        type: body.verificationStatus === "REJECTED" ? "DANGER" : "SUCCESS",
        title: body.verificationStatus === "REJECTED" ? "Obyekt rad etildi" : body.published ? "Obyekt e'lon qilindi" : "Obyekt holati yangilandi",
        body: p.name,
        link: `/app/developer/projects/${p.id}`,
      });
    }
    return projectCard(p);
  });

  app.post<{ Params: { id: string } }>("/admin/projects/:id/recalculate-trust", async (req) => {
    const r = await recalculateTrust(req.params.id);
    void audit({ actorId: req.user!.id, action: "TRUST_RECALC", entity: "Project", entityId: req.params.id, ip: req.ip, meta: { score: r.trustScore } });
    return r;
  });

  // ── certificates & documents
  app.get("/admin/certificates", async (req) => {
    const q = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.CertificateWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { OR: [{ number: { contains: q.q } }, { code: { contains: q.q } }, { issuer: { contains: q.q } }, { project: { name: { contains: q.q } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.certificate.findMany({ where, skip, take, include: { project: { select: { slug: true, name: true } } }, orderBy: orderBy(q, ["number", "type", "status", "issuedAt", "validUntil", "createdAt"], [{ status: "asc" }, { createdAt: "desc" }] as Prisma.CertificateOrderByWithRelationInput[]) }),
      prisma.certificate.count({ where }),
    ]);
    return { items: rows.map((c) => ({ ...certificateDto(c), project: c.project, createdAt: c.createdAt })), total, page, pageSize };
  });

  app.get("/admin/documents", async (req) => {
    const q = pageQuery.extend({ status: z.string().optional(), type: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.DocumentWhereInput = {
      ...archivedFilter(q.archived),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.type ? { type: q.type as never } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q } }, { number: { contains: q.q } }, { project: { name: { contains: q.q } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.document.findMany({ where, skip, take, include: { file: true, project: { select: { slug: true, name: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
      prisma.document.count({ where }),
    ]);
    return { items: rows.map((d) => ({ ...documentDto(d, true), project: d.project })), total, page, pageSize };
  });

  // ── users
  app.get("/admin/users", async (req) => {
    const q = pageQuery.extend({ role: z.string().optional(), status: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.UserWhereInput = {
      ...(q.role ? { role: q.role as never } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { OR: [{ fullName: { contains: q.q } }, { phone: { contains: q.q } }, { email: { contains: q.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, select: { ...userSelect, lastLoginAt: true, blockReason: true }, orderBy: orderBy(q, ["fullName", "phone", "role", "status", "createdAt", "lastLoginAt"], { createdAt: "desc" } as Prisma.UserOrderByWithRelationInput) }),
      prisma.user.count({ where }),
    ]);
    return { items: rows.map((u) => ({ ...userDto(u), lastLoginAt: u.lastLoginAt, blockReason: u.blockReason })), total, page, pageSize };
  });

  app.patch<{ Params: { id: string } }>("/admin/users/:id", async (req) => {
    const body = z
      .object({ role: z.enum(["BUYER", "DEVELOPER", "INSPECTOR", "ADMIN", "SUPERADMIN"]).optional(), status: z.enum(["ACTIVE", "BLOCKED"]).optional() })
      .parse(req.body);
    if (req.params.id === req.user!.id) throw badRequest("O'zingizning rolingiz yoki holatingizni o'zgartira olmaysiz");
    if ((body.role === "SUPERADMIN" || body.role === "ADMIN") && req.user!.role !== "SUPERADMIN") throw forbidden("Faqat bosh administrator admin tayinlaydi");
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound();
    if (target.role === "SUPERADMIN" && req.user!.role !== "SUPERADMIN") throw forbidden();
    const u = await prisma.user.update({ where: { id: target.id }, data: body, select: userSelect });
    if (body.status === "BLOCKED") await prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    void audit({ actorId: req.user!.id, action: "USER_UPDATE", entity: "User", entityId: u.id, ip: req.ip, meta: body });
    return userDto(u);
  });

  // ── purchases
  app.get("/admin/purchases", async (req) => {
    const q = pageQuery.extend({ status: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.PurchaseWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q ? { OR: [{ number: { contains: q.q } }, { buyer: { fullName: { contains: q.q } } }, { buyer: { phone: { contains: q.q } } }, { project: { name: { contains: q.q } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.purchase.findMany({ where, skip, take, include: purchaseInclude, orderBy: orderBy(q, ["number", "amount", "status", "createdAt", "paidAt"], { createdAt: "desc" } as Prisma.PurchaseOrderByWithRelationInput) }),
      prisma.purchase.count({ where }),
    ]);
    return { items: rows.map((r) => purchaseDto(r)), total, page, pageSize };
  });

  // ── complaints
  app.get("/admin/complaints", async (req) => {
    const q = pageQuery.extend({ status: z.string().optional(), category: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.ComplaintWhereInput = {
      ...archivedFilter(q.archived),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { message: { contains: q.q } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take,
        include: { project: { select: { slug: true, name: true } }, reporter: { select: { fullName: true, phone: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      prisma.complaint.count({ where }),
    ]);
    return { items: rows, total, page, pageSize };
  });

  app.patch<{ Params: { id: string } }>("/admin/complaints/:id", async (req) => {
    const body = z.object({ status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]), resolution: z.string().max(5000).nullable().optional() }).parse(req.body);
    const c = await prisma.complaint.update({ where: { id: req.params.id }, data: body });
    void audit({ actorId: req.user!.id, action: `COMPLAINT_${body.status}`, entity: "Complaint", entityId: c.id, ip: req.ip });
    if (c.projectId) void publish("complaint.updated", { complaintId: c.id, projectId: c.projectId });
    if (c.reporterId && (body.status === "RESOLVED" || body.status === "DISMISSED")) {
      void notify(c.reporterId, { type: "INFO", title: "Shikoyatingiz ko'rib chiqildi", body: body.resolution ?? undefined });
    }
    return c;
  });

  // ── contract templates
  const templateInput = z.object({
    key: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(2).max(191),
    kind: z.enum(["UNIT", "DOCUMENT_PACKAGE"]),
    body: z.string().min(10).max(500_000),
    active: z.boolean().default(true),
  });

  app.get("/admin/templates", async () => prisma.contractTemplate.findMany({ orderBy: [{ kind: "asc" }, { updatedAt: "desc" }] }));

  app.post("/admin/templates", async (req) => {
    const body = templateInput.parse(req.body);
    const t = await prisma.contractTemplate.create({ data: body });
    void audit({ actorId: req.user!.id, action: "TEMPLATE_CREATE", entity: "ContractTemplate", entityId: t.id, ip: req.ip, meta: { key: t.key } });
    return t;
  });

  app.patch<{ Params: { id: string } }>("/admin/templates/:id", async (req) => {
    const body = templateInput.partial().parse(req.body);
    // already generated contracts keep their own frozen text; templates are versioned
    const t = await prisma.contractTemplate.update({ where: { id: req.params.id }, data: { ...body, ...(body.body ? { version: { increment: 1 } } : {}) } });
    void audit({ actorId: req.user!.id, action: "TEMPLATE_UPDATE", entity: "ContractTemplate", entityId: t.id, ip: req.ip, meta: { version: t.version } });
    return t;
  });

  // ── rules
  const ruleInput = z.object({
    title: z.string().trim().min(2).max(255),
    slug: z.string().trim().max(191).optional(),
    category: z.string().trim().min(2).max(64),
    code: z.string().max(64).nullable().optional(),
    summary: z.string().max(512).nullable().optional(),
    body: z.string().min(1),
    sourceUrl: z.string().max(512).nullable().optional(),
    order: z.number().int().default(0),
    published: z.boolean().default(true),
  });

  app.get("/admin/rules", async () => prisma.rule.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }));

  app.post("/admin/rules", async (req) => {
    const body = ruleInput.parse(req.body);
    const r = await prisma.rule.create({ data: { ...body, slug: body.slug || slugify(body.title) } });
    void audit({ actorId: req.user!.id, action: "RULE_CREATE", entity: "Rule", entityId: r.id, ip: req.ip });
    return r;
  });

  app.patch<{ Params: { id: string } }>("/admin/rules/:id", async (req) => {
    const r = await prisma.rule.update({ where: { id: req.params.id }, data: ruleInput.partial().parse(req.body) });
    void audit({ actorId: req.user!.id, action: "RULE_UPDATE", entity: "Rule", entityId: r.id, ip: req.ip });
    return r;
  });

  app.delete<{ Params: { id: string } }>("/admin/rules/:id", async (req) => {
    await prisma.rule.delete({ where: { id: req.params.id } });
    void audit({ actorId: req.user!.id, action: "RULE_DELETE", entity: "Rule", entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });

  // ── audit
  app.get("/admin/audit", async (req) => {
    const q = pageQuery.extend({ entity: z.string().optional(), actorId: z.string().optional() }).parse(req.query);
    const { page, pageSize, skip, take } = paginate(q);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.q ? { OR: [{ action: { contains: q.q } }, { entityId: { contains: q.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { id: "desc" }, include: { actor: { select: { fullName: true, phone: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    return { items: rows.map(auditDto), total, page, pageSize };
  });

  app.get("/admin/audit/verify", async () => verifyAuditChain());
}

function auditDto(a: Prisma.AuditLogGetPayload<{ include: { actor: { select: { fullName: true; phone: true } } } }>) {
  return {
    id: a.id.toString(),
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    meta: a.meta,
    ip: a.ip,
    hash: a.hash,
    prevHash: a.prevHash,
    createdAt: a.createdAt,
    actor: a.actor,
  };
}
