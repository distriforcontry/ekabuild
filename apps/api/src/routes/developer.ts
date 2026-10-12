import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { audit } from "../lib/audit";
import { publish } from "../lib/bus";
import { certificateCode, slugify } from "../lib/codes";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { invalidate } from "../lib/redis";
import { dec, fileRef, projectCard, projectCardInclude, purchaseDto, purchaseInclude, unitDto } from "../lib/serializers";
import { ALLOWED_EXT, mimeFor, newKey, storage } from "../lib/storage";
import { isAdminRole, requireRole, type AuthUser } from "../plugins/auth";

const date = z.coerce.date();
const optDate = z.coerce.date().nullable().optional();

const massingSchema = z
  .object({
    floors: z.number().int().min(1).max(150),
    width: z.number().min(5).max(300),
    depth: z.number().min(5).max(300),
    accent: z.string().max(16).optional(),
    towers: z
      .array(z.object({ x: z.number(), z: z.number(), floors: z.number().int().min(1).max(150), width: z.number().min(5), depth: z.number().min(5) }))
      .max(8)
      .optional(),
  })
  .nullable()
  .optional();

const projectInput = z.object({
  name: z.string().trim().min(2).max(191),
  tagline: z.string().trim().max(255).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED", "INDUSTRIAL"]).default("RESIDENTIAL"),
  status: z.enum(["PLANNING", "PERMITTED", "UNDER_CONSTRUCTION", "COMPLETED", "COMMISSIONED", "SUSPENDED"]).default("PLANNING"),
  region: z.string().trim().min(2).max(128),
  district: z.string().trim().max(128).nullable().optional(),
  address: z.string().trim().min(3).max(512),
  lat: z.number().min(37).max(46),
  lng: z.number().min(55).max(74),
  cadastreNumber: z.string().trim().max(64).nullable().optional(),
  landArea: z.number().positive().nullable().optional(),
  totalArea: z.number().positive().nullable().optional(),
  floors: z.number().int().min(1).max(150).default(1),
  sections: z.number().int().min(1).max(50).default(1),
  priceFrom: z.number().nonnegative().nullable().optional(),
  pricePerSqm: z.number().nonnegative().nullable().optional(),
  packagePrice: z.number().nonnegative().nullable().optional(),
  startDate: optDate,
  plannedEndDate: optDate,
  actualEndDate: optDate,
  coverUrl: z.string().max(512).nullable().optional(),
  gallery: z.array(z.string().max(512)).max(30).optional(),
  massing: massingSchema,
});

async function ownProject(user: AuthUser, id: string) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw notFound("Obyekt topilmadi");
  if (!isAdminRole(user.role) && p.developerId !== user.orgId) throw forbidden("Bu obyekt sizga tegishli emas");
  return p;
}

function devUser(req: Parameters<typeof requireRole>[0]) {
  const u = requireRole(req, "DEVELOPER", "ADMIN");
  if (!u.orgId && !isAdminRole(u.role)) throw forbidden("Quruvchi tashkiloti biriktirilmagan");
  return u;
}

export default async function developerRoutes(app: FastifyInstance) {
  // ── uploads (developers, inspectors, admins)
  app.post("/files", async (req) => {
    const u = requireRole(req, "DEVELOPER", "INSPECTOR", "ADMIN");
    const part = await req.file({ limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 } });
    if (!part) throw badRequest("Fayl yuborilmadi");
    const ext = path.extname(part.filename).slice(1).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw badRequest(`Ruxsat etilmagan fayl turi: .${ext}`, "BAD_FILE_TYPE");
    const mime = mimeFor(ext, part.mimetype);
    const stored = await storage.save(part.file, newKey(ext), mime);
    if (part.file.truncated) {
      await storage.remove(stored.key);
      throw badRequest(`Fayl hajmi ${env.MAX_UPLOAD_MB} MB dan oshmasligi kerak`, "FILE_TOO_LARGE");
    }
    const f = await prisma.fileObject.create({
      data: { storageKey: stored.key, originalName: part.filename.slice(0, 255), mime, size: stored.size, sha256: stored.sha256, uploadedById: u.id },
    });
    return fileRef(f);
  });

  app.get("/dev/stats", async (req) => {
    const u = devUser(req);
    const where = isAdminRole(u.role) && !u.orgId ? {} : { developerId: u.orgId! };
    const [projects, sold, available, revenue, pending, avg] = await Promise.all([
      prisma.project.count({ where }),
      prisma.unit.count({ where: { project: where, status: "SOLD" } }),
      prisma.unit.count({ where: { project: where, status: "AVAILABLE" } }),
      prisma.purchase.aggregate({ where: { project: where, status: { in: ["PAID", "COMPLETED"] } }, _sum: { amount: true } }),
      prisma.contract.count({ where: { purchase: { project: where }, status: { in: ["PENDING", "PARTIALLY_SIGNED"] } } }),
      prisma.project.aggregate({ where, _avg: { trustScore: true } }),
    ]);
    return {
      projects,
      unitsSold: sold,
      unitsAvailable: available,
      revenue: dec(revenue._sum.amount) ?? "0.00",
      pendingSignatures: pending,
      avgTrust: Math.round(avg._avg.trustScore ?? 0),
    };
  });

  app.get("/dev/projects", async (req) => {
    const u = devUser(req);
    const items = await prisma.project.findMany({
      where: isAdminRole(u.role) && !u.orgId ? {} : { developerId: u.orgId! },
      include: projectCardInclude,
      orderBy: { updatedAt: "desc" },
    });
    return items.map(projectCard);
  });

  app.post("/dev/projects", async (req) => {
    const u = devUser(req);
    if (!u.orgId) throw forbidden("Tashkilot kerak");
    const body = projectInput.parse(req.body);
    let slug = slugify(body.name) || "obyekt";
    if (await prisma.project.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const p = await prisma.project.create({
      data: {
        ...body,
        massing: (body.massing ?? undefined) as Prisma.InputJsonValue | undefined,
        gallery: body.gallery ?? [],
        slug,
        developerId: u.orgId,
      },
      include: projectCardInclude,
    });
    void audit({ actorId: u.id, action: "PROJECT_CREATE", entity: "Project", entityId: p.id, ip: req.ip, meta: { name: p.name } });
    void publish("trust.recalculate", { projectId: p.id });
    return projectCard(p);
  });

  app.patch<{ Params: { id: string } }>("/dev/projects/:id", async (req) => {
    const u = devUser(req);
    await ownProject(u, req.params.id);
    const body = projectInput.partial().extend({ progress: z.number().int().min(0).max(100).optional() }).parse(req.body);
    const p = await prisma.project.update({
      where: { id: req.params.id },
      data: { ...body, massing: body.massing === undefined ? undefined : ((body.massing ?? null) as Prisma.InputJsonValue) },
      include: projectCardInclude,
    });
    void audit({ actorId: u.id, action: "PROJECT_UPDATE", entity: "Project", entityId: p.id, ip: req.ip, meta: { fields: Object.keys(body) } });
    void publish("trust.recalculate", { projectId: p.id });
    await invalidate("projects:map", "stats:public");
    return projectCard(p);
  });

  app.post<{ Params: { id: string } }>("/dev/projects/:id/submit", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    await prisma.project.update({ where: { id: p.id }, data: { verificationStatus: "PENDING" } });
    void audit({ actorId: u.id, action: "PROJECT_SUBMIT", entity: "Project", entityId: p.id, ip: req.ip });
    void publish("project.submitted", { projectId: p.id });
    return { ok: true };
  });

  // ── units
  app.post<{ Params: { id: string } }>("/dev/projects/:id/units", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    const unitInput = z.object({
      number: z.string().max(32),
      section: z.number().int().min(1).default(1),
      floor: z.number().int().min(-5).max(150),
      type: z.enum(["APARTMENT", "COMMERCIAL", "OFFICE", "PARKING", "STORAGE"]).default("APARTMENT"),
      rooms: z.number().int().min(0).max(20).default(1),
      area: z.number().positive(),
      price: z.number().nonnegative(),
      planUrl: z.string().max(512).nullable().optional(),
    });
    const body = z
      .union([
        z.object({ units: z.array(unitInput).min(1).max(2000) }),
        z.object({
          generate: z.object({
            sections: z.number().int().min(1).max(20),
            floors: z.number().int().min(1).max(100),
            perFloor: z.number().int().min(1).max(20),
            areaMin: z.number().positive(),
            areaMax: z.number().positive(),
            pricePerSqm: z.number().positive(),
            startFloor: z.number().int().min(1).default(2),
          }),
        }),
      ])
      .parse(req.body);

    let units: z.infer<typeof unitInput>[];
    if ("units" in body) units = body.units;
    else {
      const g = body.generate;
      units = [];
      for (let s = 1; s <= g.sections; s++)
        for (let f = g.startFloor; f <= g.floors; f++)
          for (let i = 1; i <= g.perFloor; i++) {
            // deterministic spread of areas across the floor, small premium for higher floors
            const t = g.perFloor === 1 ? 0.5 : (i - 1) / (g.perFloor - 1);
            const area = Math.round((g.areaMin + (g.areaMax - g.areaMin) * t) * 10) / 10;
            const rooms = area < 50 ? 1 : area < 75 ? 2 : area < 100 ? 3 : 4;
            const price = Math.round(area * g.pricePerSqm * (1 + (f - g.startFloor) * 0.005));
            units.push({ number: `${f}${String(i).padStart(2, "0")}`, section: s, floor: f, type: "APARTMENT", rooms, area, price });
          }
    }
    const created = await prisma.unit.createMany({
      data: units.map((x) => ({ ...x, projectId: p.id })),
      skipDuplicates: true,
    });
    const total = await prisma.unit.count({ where: { projectId: p.id } });
    const min = await prisma.unit.aggregate({ where: { projectId: p.id }, _min: { price: true } });
    await prisma.project.update({ where: { id: p.id }, data: { unitsTotal: total, priceFrom: min._min.price ?? undefined } });
    void audit({ actorId: u.id, action: "UNITS_CREATE", entity: "Project", entityId: p.id, ip: req.ip, meta: { count: created.count } });
    return { created: created.count, total };
  });

  app.patch<{ Params: { id: string } }>("/dev/units/:id", async (req) => {
    const u = devUser(req);
    const unit = await prisma.unit.findUnique({ where: { id: req.params.id } });
    if (!unit) throw notFound();
    await ownProject(u, unit.projectId);
    const body = z
      .object({
        price: z.number().nonnegative().optional(),
        status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).optional(),
        area: z.number().positive().optional(),
        rooms: z.number().int().min(0).optional(),
        planUrl: z.string().max(512).nullable().optional(),
      })
      .parse(req.body);
    // a unit in an active deal can't be put back on sale manually
    if (body.status === "AVAILABLE") {
      const active = await prisma.purchase.findFirst({ where: { activeUnitLock: unit.id } });
      if (active) throw badRequest("Bu xonadon bo'yicha faol bitim mavjud", "UNIT_LOCKED");
    }
    const updated = await prisma.unit.update({ where: { id: unit.id }, data: body });
    void audit({ actorId: u.id, action: "UNIT_UPDATE", entity: "Unit", entityId: unit.id, ip: req.ip, meta: body });
    return unitDto(updated);
  });

  // ── documents & certificates
  app.post<{ Params: { id: string } }>("/dev/projects/:id/documents", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    const body = z
      .object({
        type: z.enum([
          "BUILDING_PERMIT",
          "LICENSE",
          "EXPERTISE",
          "CADASTRE_EXTRACT",
          "LAND_ALLOTMENT",
          "CONFORMITY_CERT",
          "COMMISSIONING_ACT",
          "DRAWING",
          "MODEL_3D",
          "FLOOR_PLAN",
          "REGULATION",
          "CONTRACT",
          "PHOTO",
          "OTHER",
        ]),
        title: z.string().trim().min(2).max(255),
        description: z.string().max(5000).nullable().optional(),
        number: z.string().max(128).nullable().optional(),
        issuer: z.string().max(255).nullable().optional(),
        issuedAt: optDate,
        expiresAt: optDate,
        access: z.enum(["PUBLIC", "BUYERS", "PRIVATE"]).default("PUBLIC"),
        fileId: z.string(),
      })
      .parse(req.body);
    const file = await prisma.fileObject.findUnique({ where: { id: body.fileId }, include: { document: true } });
    if (!file || file.document) throw badRequest("Fayl topilmadi yoki allaqachon biriktirilgan");
    if (file.uploadedById !== u.id && !isAdminRole(u.role)) throw forbidden();
    const prevVersion = await prisma.document.count({ where: { projectId: p.id, type: body.type, title: body.title } });
    const doc = await prisma.document.create({ data: { ...body, projectId: p.id, version: prevVersion + 1 }, include: { file: true } });
    void audit({ actorId: u.id, action: "DOCUMENT_UPLOAD", entity: "Document", entityId: doc.id, ip: req.ip, meta: { type: doc.type, sha256: file.sha256 } });
    void publish("document.created", { documentId: doc.id, projectId: p.id });
    return { id: doc.id };
  });

  app.delete<{ Params: { id: string } }>("/dev/documents/:id", async (req) => {
    const u = devUser(req);
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw notFound();
    await ownProject(u, doc.projectId);
    if (doc.status === "VERIFIED" && !isAdminRole(u.role)) throw forbidden("Tasdiqlangan hujjatni o'chirib bo'lmaydi — yangi versiya yuklang");
    await prisma.document.delete({ where: { id: doc.id } });
    void audit({ actorId: u.id, action: "DOCUMENT_DELETE", entity: "Document", entityId: doc.id, ip: req.ip, meta: { title: doc.title } });
    void publish("document.deleted", { projectId: doc.projectId });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/dev/projects/:id/certificates", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    const body = z
      .object({
        type: z.enum(["BUILDING_PERMIT", "CONSTRUCTION_LICENSE", "STATE_EXPERTISE", "CONFORMITY", "COMMISSIONING", "FIRE_SAFETY", "ENVIRONMENTAL"]),
        number: z.string().trim().min(2).max(128),
        issuer: z.string().trim().min(2).max(255),
        issuedAt: date,
        validUntil: optDate,
        documentId: z.string().nullable().optional(),
      })
      .parse(req.body);
    const dup = await prisma.certificate.findUnique({ where: { type_number: { type: body.type, number: body.number } } });
    if (dup) throw badRequest("Bu raqamli sertifikat allaqachon ro'yxatda — bu firibgarlik belgisi bo'lishi mumkin", "CERT_DUPLICATE");
    const cert = await prisma.certificate.create({ data: { ...body, code: certificateCode(), projectId: p.id } });
    void audit({ actorId: u.id, action: "CERTIFICATE_CREATE", entity: "Certificate", entityId: cert.id, ip: req.ip, meta: { type: cert.type, number: cert.number } });
    void publish("certificate.created", { certificateId: cert.id, projectId: p.id });
    return { id: cert.id, code: cert.code };
  });

  app.post<{ Params: { id: string } }>("/dev/projects/:id/progress", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    const body = z
      .object({
        phase: z.enum(["CONSTRUCTION", "POST_HANDOVER"]).default("CONSTRUCTION"),
        title: z.string().trim().min(2).max(255),
        body: z.string().max(10000).nullable().optional(),
        stage: z.string().max(128).nullable().optional(),
        percent: z.number().int().min(0).max(100).nullable().optional(),
        date,
        fileIds: z.array(z.string()).max(30).optional(),
      })
      .parse(req.body);
    const { fileIds, ...data } = body;
    const post = await prisma.progressUpdate.create({
      data: { ...data, projectId: p.id, authorId: u.id, media: fileIds?.length ? { create: fileIds.map((fileId) => ({ fileId })) } : undefined },
    });
    if (body.percent != null && body.phase === "CONSTRUCTION") await prisma.project.update({ where: { id: p.id }, data: { progress: body.percent } });
    void audit({ actorId: u.id, action: "PROGRESS_POST", entity: "Project", entityId: p.id, ip: req.ip, meta: { title: body.title, phase: body.phase } });
    void publish("project.progress", { projectId: p.id, progressId: post.id, phase: body.phase, title: body.title });
    return { id: post.id };
  });

  app.post<{ Params: { id: string } }>("/dev/projects/:id/model3d", async (req) => {
    const u = devUser(req);
    const p = await ownProject(u, req.params.id);
    const { fileId } = z.object({ fileId: z.string() }).parse(req.body);
    const f = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!f || !["model/gltf-binary", "model/gltf+json"].includes(f.mime)) throw badRequest("GLB/GLTF fayl kerak", "BAD_FILE_TYPE");
    await prisma.project.update({ where: { id: p.id }, data: { model3dId: f.id } });
    void audit({ actorId: u.id, action: "MODEL3D_SET", entity: "Project", entityId: p.id, ip: req.ip, meta: { sha256: f.sha256 } });
    return { ok: true, model3d: fileRef(f) };
  });

  app.get("/dev/purchases", async (req) => {
    const u = devUser(req);
    const rows = await prisma.purchase.findMany({
      where: isAdminRole(u.role) && !u.orgId ? {} : { project: { developerId: u.orgId! } },
      include: purchaseInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map(purchaseDto);
  });
}
