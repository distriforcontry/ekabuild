import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { REGIONS } from "@eka/shared";
import { prisma } from "../db";
import { canSee, projectAccess } from "../lib/access";
import { audit } from "../lib/audit";
import { publish } from "../lib/bus";
import { notFound } from "../lib/errors";
import { cached } from "../lib/redis";
import { track } from "../lib/activity";
import { canResize, nearestWidth, variantStream } from "../lib/images";
import { storage } from "../lib/storage";
import {
  certificateDto,
  dec,
  documentDto,
  fileRef,
  listedProject,
  orgDto,
  paginate,
  projectCard,
  projectCardInclude,
  unitDto,
} from "../lib/serializers";
import { isAdminRole, isStaffRole, requireUser } from "../plugins/auth";
import { businessEvents } from "../lib/metrics";

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  region: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  developerId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  featured: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  verified: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  sort: z.enum(["trust", "new", "price_asc", "price_desc", "progress"]).optional(),
  /** "all" includes unpublished projects — staff only (inspectors searching for any object) */
  scope: z.enum(["published", "all"]).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export default async function publicRoutes(app: FastifyInstance) {
  app.get("/stats/public", async () =>
    cached("stats:public", 60, async () => {
      const [projects, developers, verifiedCertificates, inspections, unitsSold, avg, regions] = await Promise.all([
        prisma.project.count({ where: listedProject }),
        prisma.organization.count({ where: { type: "DEVELOPER", status: "VERIFIED", blockedAt: null, archivedAt: null } }),
        prisma.certificate.count({ where: { status: "VERIFIED" } }),
        prisma.inspection.count(),
        prisma.unit.count({ where: { status: "SOLD" } }),
        prisma.project.aggregate({ where: listedProject, _avg: { trustScore: true } }),
        prisma.project.findMany({ where: listedProject, distinct: ["region"], select: { region: true } }),
      ]);
      return { projects, developers, verifiedCertificates, inspections, unitsSold, avgTrust: Math.round(avg._avg.trustScore ?? 0), regions: regions.length };
    }),
  );

  // ── catalog
  app.get("/projects", async (req) => {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = paginate(q, 48);
    if (q.q && (q.page ?? 1) === 1) track("search", { userId: req.user?.id, meta: { q: q.q.slice(0, 64), region: q.region ?? null } });
    const where: Prisma.ProjectWhereInput = q.scope === "all" && isStaffRole(req.user?.role) ? {} : { ...listedProject };
    if (q.q) where.OR = [{ name: { contains: q.q } }, { address: { contains: q.q } }, { district: { contains: q.q } }, { developer: { name: { contains: q.q } } }];
    if (q.region) where.region = q.region;
    if (q.status) where.status = q.status as Prisma.EnumProjectStatusFilter["equals"];
    if (q.type) where.type = q.type as Prisma.EnumProjectTypeFilter["equals"];
    if (q.developerId) where.developerId = q.developerId;
    if (q.featured) where.featured = true;
    if (q.verified) where.verificationStatus = "VERIFIED";
    if (q.minPrice != null || q.maxPrice != null) where.priceFrom = { ...(q.minPrice != null ? { gte: q.minPrice } : {}), ...(q.maxPrice != null ? { lte: q.maxPrice } : {}) };
    const orderBy: Prisma.ProjectOrderByWithRelationInput[] =
      q.sort === "new"
        ? [{ createdAt: "desc" }]
        : q.sort === "price_asc"
          ? [{ priceFrom: "asc" }]
          : q.sort === "price_desc"
            ? [{ priceFrom: "desc" }]
            : q.sort === "progress"
              ? [{ progress: "desc" }]
              : [{ featured: "desc" }, { trustScore: "desc" }];
    const [items, total] = await Promise.all([
      prisma.project.findMany({ where, orderBy, skip, take, include: projectCardInclude }),
      prisma.project.count({ where }),
    ]);
    return { items: items.map(projectCard), total, page, pageSize };
  });

  app.get("/projects/map", async () =>
    cached("projects:map", 60, () =>
      prisma.project.findMany({
        where: listedProject,
        select: { id: true, slug: true, name: true, lat: true, lng: true, trustScore: true, status: true, coverUrl: true },
      }),
    ),
  );

  app.get<{ Params: { slug: string } }>("/projects/:slug", async (req) => {
    const p = await prisma.project.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      include: {
        developer: { include: { _count: { select: { projects: { where: { published: true, archivedAt: null } } } } } },
        model3d: true,
        certificates: { orderBy: { issuedAt: "desc" } },
        documents: { where: { archivedAt: null }, include: { file: true }, orderBy: [{ type: "asc" }, { createdAt: "desc" }] },
        cadastreChecks: { orderBy: { createdAt: "desc" }, take: 1 },
        inspections: {
          orderBy: { date: "desc" },
          include: { inspector: { select: { id: true, fullName: true, organization: { select: { name: true } } } }, files: { include: { file: true } } },
        },
        progressPosts: { orderBy: { date: "desc" }, include: { author: { select: { fullName: true } }, media: { include: { file: true } } } },
        _count: { select: { units: { where: { status: "AVAILABLE" } } } },
      },
    });
    if (!p) throw notFound("Obyekt topilmadi");
    const access = await projectAccess(req.user, p);
    const listed = p.published && !p.archivedAt && !p.developer.blockedAt;
    if (!listed && !access.isOwner && !access.isStaff) {
      // buyers keep access to objects they already bought, even after archiving / blocking
      const owns = req.user ? await prisma.purchase.count({ where: { projectId: p.id, OR: [{ buyerId: req.user.id }, ...(req.user.orgId ? [{ buyerOrgId: req.user.orgId }] : [])] } }) : 0;
      if (!p.published || !owns) throw notFound("Obyekt topilmadi");
    }

    const [unitGroups, isFavorite, purchases] = await Promise.all([
      prisma.unit.groupBy({ by: ["status"], where: { projectId: p.id }, _count: true }),
      req.user ? prisma.favorite.findUnique({ where: { userId_projectId: { userId: req.user.id, projectId: p.id } } }) : null,
      req.user
        ? prisma.purchase.findMany({
            where: { projectId: p.id, OR: [{ buyerId: req.user.id }, ...(req.user.orgId ? [{ buyerOrgId: req.user.orgId }] : [])] },
            select: { id: true, number: true, kind: true, status: true, unitId: true },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ]);
    const unitsSummary = { AVAILABLE: 0, RESERVED: 0, SOLD: 0 };
    for (const g of unitGroups) unitsSummary[g.status] = g._count;
    const cad = p.cadastreChecks[0];
    const { _count: devCount, ...developer } = p.developer;

    return {
      ...projectCard({ ...p, developer: { id: p.developer.id, name: p.developer.name, logoUrl: p.developer.logoUrl, status: p.developer.status, blockedAt: p.developer.blockedAt } }),
      description: p.description,
      cadastreNumber: p.cadastreNumber,
      landArea: p.landArea,
      totalArea: p.totalArea,
      sections: p.sections,
      startDate: p.startDate,
      actualEndDate: p.actualEndDate,
      gallery: (p.gallery as string[] | null) ?? [],
      massing: p.massing,
      model3d: fileRef(p.model3d),
      packagePrice: dec(p.packagePrice),
      trustBreakdown: p.trustBreakdown ?? [],
      views: p.views,
      developer: { ...orgDto(developer), projectsCount: devCount.projects },
      certificates: p.certificates.map(certificateDto),
      documents: p.documents.map((d) => documentDto(d, canSee(d.access, access))),
      cadastre: cad ? { id: cad.id, cadastreNumber: cad.cadastreNumber, provider: cad.provider, result: cad.result, distanceM: cad.distanceM, details: cad.details, createdAt: cad.createdAt } : null,
      inspections: p.inspections.map((i) => ({
        id: i.id,
        type: i.type,
        result: i.result,
        date: i.date,
        summary: i.summary,
        notes: i.notes,
        violations: i.violations ?? [],
        inspector: { id: i.inspector.id, fullName: i.inspector.fullName, organization: i.inspector.organization?.name ?? null },
        files: i.files.map((f) => fileRef(f.file)),
      })),
      progressUpdates: p.progressPosts.map((u) => ({
        id: u.id,
        phase: u.phase,
        title: u.title,
        body: u.body,
        stage: u.stage,
        percent: u.percent,
        date: u.date,
        author: u.author,
        media: u.media.map((m) => fileRef(m.file)),
      })),
      unitsSummary,
      viewer: {
        authenticated: !!req.user,
        isFavorite: !!isFavorite,
        hasAccess: access.hasPurchase || access.isOwner || access.isStaff,
        isOwner: access.isOwner,
        purchases,
      },
    };
  });

  app.get<{ Params: { slug: string } }>("/projects/:slug/units", async (req) => {
    const p = await prisma.project.findFirst({ where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] }, select: { id: true } });
    if (!p) throw notFound();
    const units = await prisma.unit.findMany({ where: { projectId: p.id }, orderBy: [{ section: "asc" }, { floor: "asc" }, { number: "asc" }] });
    return units.map(unitDto);
  });

  app.post<{ Params: { id: string } }>("/projects/:id/view", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const r = await prisma.project.updateMany({ where: { id: req.params.id }, data: { views: { increment: 1 } } });
    if (r.count) track("project_view", { projectId: req.params.id, userId: req.user?.id, sessionId: req.headers["x-session-id"] as string | undefined });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/projects/:id/favorite", async (req) => {
    const u = requireUser(req);
    const key = { userId_projectId: { userId: u.id, projectId: req.params.id } };
    const existing = await prisma.favorite.findUnique({ where: key });
    if (existing) {
      await prisma.favorite.delete({ where: key });
      return { favorite: false };
    }
    await prisma.favorite.create({ data: { userId: u.id, projectId: req.params.id } });
    track("favorite", { projectId: req.params.id, userId: u.id });
    return { favorite: true };
  });

  app.get("/favorites", async (req) => {
    const u = requireUser(req);
    const favs = await prisma.favorite.findMany({ where: { userId: u.id }, include: { project: { include: projectCardInclude } }, orderBy: { createdAt: "desc" } });
    return favs.map((f) => projectCard(f.project));
  });

  // ── developers
  app.get("/developers", async (req) => {
    const { q, region } = z.object({ q: z.string().optional(), region: z.string().optional() }).parse(req.query);
    const orgs = await prisma.organization.findMany({
      where: { type: "DEVELOPER", status: "VERIFIED", blockedAt: null, archivedAt: null, ...(q ? { name: { contains: q } } : {}), ...(region ? { region } : {}) },
      include: { projects: { where: { published: true, archivedAt: null }, select: { trustScore: true } } },
      orderBy: { name: "asc" },
    });
    return orgs.map(({ projects, ...o }) => ({
      ...orgDto(o),
      projectsCount: projects.length,
      avgTrust: projects.length ? Math.round(projects.reduce((s, p) => s + p.trustScore, 0) / projects.length) : 0,
    }));
  });

  app.get<{ Params: { id: string } }>("/developers/:id", async (req) => {
    const org = await prisma.organization.findFirst({ where: { id: req.params.id, type: "DEVELOPER" } });
    if (!org) throw notFound();
    const projects = await prisma.project.findMany({ where: { developerId: org.id, ...listedProject }, include: projectCardInclude, orderBy: { trustScore: "desc" } });
    return { ...orgDto(org), projects: projects.map(projectCard) };
  });

  // ── public verification
  const certPublic = async (where: Prisma.CertificateWhereInput) => {
    const certs = await prisma.certificate.findMany({
      where,
      take: 10,
      include: {
        project: { select: { id: true, slug: true, name: true, address: true, region: true, developer: { select: { name: true, tin: true, status: true } } } },
        document: { select: { title: true, file: { select: { sha256: true } } } },
      },
    });
    return certs.map((c) => ({
      certificate: certificateDto(c),
      project: c.project,
      document: c.document ? { title: c.document.title, sha256: c.document.file.sha256 } : null,
    }));
  };

  app.get<{ Params: { code: string } }>("/verify/:code", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const [hit] = await certPublic({ code: req.params.code.trim().toUpperCase() });
    track("certificate_lookup", { projectId: hit?.project.id ?? null, userId: req.user?.id, meta: { found: !!hit } });
    if (!hit) throw notFound("Sertifikat topilmadi", "CERT_NOT_FOUND");
    void publish("certificate.checked", { code: req.params.code });
    businessEvents.inc({ event: "certificate_verified_lookup" });
    return hit;
  });

  app.get("/verify", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const { number } = z.object({ number: z.string().trim().min(2).max(128) }).parse(req.query);
    return { items: await certPublic({ OR: [{ number }, { code: number.toUpperCase() }] }) };
  });

  app.post("/verify/file", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const part = await req.file({ limits: { fileSize: 200 * 1024 * 1024 } });
    if (!part) throw notFound("Fayl yuborilmadi");
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256");
    for await (const chunk of part.file) hash.update(chunk as Buffer);
    const digest = hash.digest("hex");
    const file = await prisma.fileObject.findFirst({
      where: { sha256: digest, document: { isNot: null } },
      include: { document: { include: { project: { select: { slug: true, name: true } } } } },
    });
    track("file_check", { projectId: file?.document?.projectId ?? null, userId: req.user?.id, meta: { match: !!file?.document } });
    if (!file?.document) return { match: false, sha256: digest };
    const d = file.document;
    return { match: true, sha256: digest, document: { title: d.title, type: d.type, status: d.status, issuedAt: d.issuedAt, number: d.number, project: d.project } };
  });

  // ── rules
  app.get("/rules", async (req) => {
    const { category } = z.object({ category: z.string().optional() }).parse(req.query);
    return prisma.rule.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      select: { id: true, slug: true, title: true, category: true, code: true, summary: true, sourceUrl: true, order: true },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
  });

  app.get<{ Params: { slug: string } }>("/rules/:slug", async (req) => {
    const r = await prisma.rule.findUnique({ where: { slug: req.params.slug } });
    if (!r || !r.published) throw notFound();
    return r;
  });

  // ── complaints / fraud reports
  app.post("/complaints", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (req) => {
    const body = z
      .object({
        projectId: z.string().optional(),
        category: z.enum(["FRAUD", "FAKE_DOCUMENT", "DELAY", "QUALITY", "DOUBLE_SALE", "OTHER"]),
        message: z.string().trim().min(10).max(5000),
        contact: z.string().trim().max(191).optional(),
      })
      .parse(req.body);
    const c = await prisma.complaint.create({ data: { ...body, reporterId: req.user?.id } });
    void audit({ actorId: req.user?.id, action: "COMPLAINT_CREATE", entity: "Complaint", entityId: c.id, ip: req.ip, meta: { category: body.category, projectId: body.projectId } });
    void publish("complaint.created", { complaintId: c.id, projectId: body.projectId ?? null });
    businessEvents.inc({ event: `complaint_${body.category.toLowerCase()}` });
    return { id: c.id };
  });

  // regions helper for filters
  app.get("/meta/regions", async () => REGIONS);

  // ── files (auth-gated streaming)
  app.get<{ Params: { id: string }; Querystring: { download?: string; w?: string } }>("/files/:id", async (req, reply) => {
    const f = await prisma.fileObject.findUnique({
      where: { id: req.params.id },
      include: {
        document: { select: { access: true, project: { select: { id: true, developerId: true } } } },
        projectModel: { select: { id: true, developerId: true, published: true } },
        progressMedia: { take: 1, select: { progress: { select: { project: { select: { published: true } } } } } },
        inspectionFile: { take: 1, select: { inspection: { select: { project: { select: { published: true } } } } } },
      },
    });
    if (!f) throw notFound("Fayl topilmadi");

    let allowed = false;
    if (f.document) {
      allowed = canSee(f.document.access, await projectAccess(req.user, f.document.project));
    } else if (f.projectModel || f.progressMedia.length || f.inspectionFile.length) {
      allowed = true; // public media of a project (3D model, progress photos, inspection photos)
    } else {
      // unattached upload: images are referenced by URL as project covers / gallery / unit plans → public;
      // anything else stays private to the uploader and admins until it is attached to a document
      allowed = f.mime.startsWith("image/") || (!!req.user && (req.user.id === f.uploadedById || isAdminRole(req.user.role)));
    }
    if (!allowed) {
      if (!req.user) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Kirish talab qilinadi" } });
      return reply.code(403).send({ error: { code: "LOCKED", message: "Bu fayl faqat xaridorlar uchun" } });
    }

    const publicCache = !(f.document && f.document.access !== "PUBLIC");

    // responsive WebP variant
    const w = Number(req.query.w);
    if (w > 0 && canResize(f.mime) && !req.query.download) {
      const width = nearestWidth(w);
      const etag = `"${f.sha256.slice(0, 16)}-w${width}"`;
      if (req.headers["if-none-match"] === etag) return reply.code(304).send();
      try {
        const { stream: variant } = await variantStream(f.storageKey, width);
        return reply
          .header("content-type", "image/webp")
          .header("etag", etag)
          .header("vary", "Accept")
          .header("cache-control", publicCache ? "public, max-age=31536000, immutable" : "private, max-age=3600")
          .send(variant);
      } catch (e) {
        req.log.warn({ err: (e as Error).message, file: f.id }, "image variant failed, serving original");
      }
    }

    const stream = await storage.read(f.storageKey).catch(() => null);
    if (!stream) throw notFound("Fayl omborda topilmadi");
    const disposition = req.query.download ? "attachment" : "inline";
    reply
      .header("content-type", f.mime)
      .header("content-length", f.size)
      .header("etag", `"${f.sha256}"`)
      .header("x-content-sha256", f.sha256)
      .header("cache-control", publicCache ? "public, max-age=86400, immutable" : "private, max-age=300")
      .header("content-disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`);
    if (req.headers["if-none-match"] === `"${f.sha256}"`) return reply.code(304).send();
    return reply.send(stream);
  });
}
