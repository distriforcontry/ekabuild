import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../lib/audit";
import { publish } from "../lib/bus";
import { runCadastreCheck } from "../lib/cadastre-check";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { notifyOrgMembers } from "../lib/notify";
import { certificateDto } from "../lib/serializers";
import { isStaffRole, requireRole, requireUser } from "../plugins/auth";

export default async function inspectionRoutes(app: FastifyInstance) {
  app.post("/inspections", async (req) => {
    const u = requireRole(req, "INSPECTOR", "ADMIN");
    const body = z
      .object({
        projectId: z.string(),
        type: z.enum(["SCHEDULED", "UNSCHEDULED", "FOUNDATION", "FRAME", "ENGINEERING", "FINAL"]),
        result: z.enum(["PASSED", "ISSUES", "FAILED"]),
        date: z.coerce.date(),
        summary: z.string().trim().min(5).max(512),
        notes: z.string().max(20000).nullable().optional(),
        violations: z
          .array(z.object({ code: z.string().max(64), text: z.string().max(1000), severity: z.enum(["LOW", "MEDIUM", "HIGH"]), resolved: z.boolean().default(false) }))
          .max(100)
          .optional(),
        fileIds: z.array(z.string()).max(30).optional(),
      })
      .parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) throw notFound("Obyekt topilmadi");
    const { fileIds, violations, ...data } = body;
    const ins = await prisma.inspection.create({
      data: {
        ...data,
        violations: (violations ?? []) as Prisma.InputJsonValue,
        inspectorId: u.id,
        files: fileIds?.length ? { create: fileIds.map((fileId) => ({ fileId })) } : undefined,
      },
    });
    void audit({ actorId: u.id, action: "INSPECTION_CREATE", entity: "Inspection", entityId: ins.id, ip: req.ip, meta: { projectId: project.id, result: body.result } });
    void publish("inspection.created", { inspectionId: ins.id, projectId: project.id, result: body.result });
    void notifyOrgMembers(project.developerId, {
      type: body.result === "PASSED" ? "SUCCESS" : body.result === "ISSUES" ? "WARNING" : "DANGER",
      title: "Yangi nazorat dalolatnomasi",
      body: `${project.name}: ${body.summary}`,
      link: `/projects/${project.slug}#inspections`,
    });
    return { id: ins.id };
  });

  app.post("/cadastre/check", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const u = requireUser(req);
    const { projectId } = z.object({ projectId: z.string() }).parse(req.body);
    const p = await prisma.project.findUnique({ where: { id: projectId }, select: { developerId: true } });
    if (!p) throw notFound();
    if (!isStaffRole(u.role) && p.developerId !== u.orgId) throw forbidden();
    const check = await runCadastreCheck(projectId, u.id);
    void audit({ actorId: u.id, action: "CADASTRE_CHECK", entity: "Project", entityId: projectId, ip: req.ip, meta: { result: check.result } });
    return check;
  });

  app.patch<{ Params: { id: string } }>("/certificates/:id/verify", async (req) => {
    const u = requireRole(req, "INSPECTOR", "ADMIN");
    const body = z.object({ status: z.enum(["VERIFIED", "REJECTED", "REVOKED"]), note: z.string().max(512).nullable().optional() }).parse(req.body);
    const c = await prisma.certificate.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!c) throw notFound();
    const updated = await prisma.certificate.update({
      where: { id: c.id },
      data: { status: body.status, note: body.note ?? null, verifiedById: u.id, verifiedAt: new Date() },
    });
    // keep the linked document's verification status in sync
    if (c.documentId) {
      await prisma.document.update({
        where: { id: c.documentId },
        data: { status: body.status === "VERIFIED" ? "VERIFIED" : "REJECTED", verifiedById: u.id, verifiedAt: new Date() },
      });
    }
    void audit({ actorId: u.id, action: `CERTIFICATE_${body.status}`, entity: "Certificate", entityId: c.id, ip: req.ip, meta: { number: c.number, note: body.note } });
    void publish(`certificate.${body.status.toLowerCase()}`, { certificateId: c.id, projectId: c.projectId });
    void notifyOrgMembers(c.project.developerId, {
      type: body.status === "VERIFIED" ? "SUCCESS" : "DANGER",
      title: body.status === "VERIFIED" ? "Sertifikat tasdiqlandi" : "Sertifikat rad etildi",
      body: `${c.number}${body.note ? ` — ${body.note}` : ""}`,
      link: `/app/developer/projects/${c.projectId}`,
    });
    return certificateDto(updated);
  });

  app.patch<{ Params: { id: string } }>("/documents/:id/verify", async (req) => {
    const u = requireRole(req, "INSPECTOR", "ADMIN");
    const body = z.object({ status: z.enum(["VERIFIED", "REJECTED"]), rejectReason: z.string().max(512).nullable().optional() }).parse(req.body);
    const d = await prisma.document.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!d) throw notFound();
    await prisma.document.update({
      where: { id: d.id },
      data: { status: body.status, rejectReason: body.status === "REJECTED" ? (body.rejectReason ?? null) : null, verifiedById: u.id, verifiedAt: new Date() },
    });
    void audit({ actorId: u.id, action: `DOCUMENT_${body.status}`, entity: "Document", entityId: d.id, ip: req.ip, meta: { title: d.title, reason: body.rejectReason } });
    void publish(`document.${body.status.toLowerCase()}`, { documentId: d.id, projectId: d.projectId });
    void notifyOrgMembers(d.project.developerId, {
      type: body.status === "VERIFIED" ? "SUCCESS" : "WARNING",
      title: body.status === "VERIFIED" ? "Hujjat tasdiqlandi" : "Hujjat rad etildi",
      body: `${d.title}${body.rejectReason ? ` — ${body.rejectReason}` : ""}`,
      link: `/app/developer/projects/${d.projectId}`,
    });
    return { ok: true };
  });

  // inspectors' queue (admins use /admin/*)
  // inspections written by the current inspector (admins: everyone's), newest first
  app.get("/inspector/inspections", async (req) => {
    const u = requireRole(req, "INSPECTOR", "ADMIN");
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        result: z.enum(["PASSED", "ISSUES", "FAILED"]).optional(),
        projectId: z.string().optional(),
        mine: z.enum(["0", "1"]).optional(),
      })
      .parse(req.query);
    const where: Prisma.InspectionWhereInput = {
      ...(u.role === "INSPECTOR" || q.mine === "1" ? { inspectorId: u.id } : {}),
      ...(q.result ? { result: q.result } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
    };
    const [rows, total, byResult] = await Promise.all([
      prisma.inspection.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { project: { select: { id: true, slug: true, name: true, region: true, coverUrl: true } }, inspector: { select: { fullName: true } }, _count: { select: { files: true } } },
      }),
      prisma.inspection.count({ where }),
      prisma.inspection.groupBy({ by: ["result"], where, _count: true }),
    ]);
    return {
      items: rows.map((i) => ({
        id: i.id,
        type: i.type,
        result: i.result,
        date: i.date,
        summary: i.summary,
        violations: Array.isArray(i.violations) ? i.violations.length : 0,
        files: i._count.files,
        inspector: i.inspector.fullName,
        project: i.project,
        createdAt: i.createdAt,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      byResult: Object.fromEntries(byResult.map((r) => [r.result, r._count])),
    };
  });

  app.get("/inspector/queue", async (req) => {
    requireRole(req, "INSPECTOR", "ADMIN");
    const [certificates, documents] = await Promise.all([
      prisma.certificate.findMany({ where: { status: "PENDING" }, include: { project: { select: { slug: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 100 }),
      prisma.document.findMany({
        where: { status: "PENDING" },
        include: { project: { select: { slug: true, name: true } }, file: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);
    return {
      certificates: certificates.map((c) => ({ ...certificateDto(c), project: c.project })),
      documents: documents.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        number: d.number,
        issuer: d.issuer,
        status: d.status,
        createdAt: d.createdAt,
        project: d.project,
        file: { id: d.file.id, url: `/api/v1/files/${d.file.id}`, originalName: d.file.originalName, mime: d.file.mime, size: d.file.size, sha256: d.file.sha256 },
      })),
    };
  });

}
