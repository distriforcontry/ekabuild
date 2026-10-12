import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma, SignerRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { canSee, projectAccess } from "../lib/access";
import { audit } from "../lib/audit";
import { sha256 } from "../lib/auth";
import { publish } from "../lib/bus";
import { docNumber } from "../lib/codes";
import { contractContext, renderTemplate, signingPayload } from "../lib/contracts";
import { verifyPkcs7 } from "../lib/eimzo";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { notify, notifyOrgMembers } from "../lib/notify";
import { documentDto, fileRef, purchaseDto, purchaseInclude } from "../lib/serializers";
import { isAdminRole, requireUser, type AuthUser } from "../plugins/auth";

const DEFAULT_TEMPLATES = {
  UNIT: "unit-sale",
  DOCUMENT_PACKAGE: "document-package",
} as const;

function purchaseVisibleTo(user: AuthUser): Prisma.PurchaseWhereInput {
  if (isAdminRole(user.role)) return {};
  return { OR: [{ buyerId: user.id }, ...(user.orgId ? [{ buyerOrgId: user.orgId }, { project: { developerId: user.orgId } }] : [])] };
}

async function loadContract(id: string, user: AuthUser) {
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      purchase: { include: purchaseInclude },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!c) throw notFound("Shartnoma topilmadi");
  const p = c.purchase;
  const isBuyer = p.buyerId === user.id || (!!user.orgId && p.buyerOrgId === user.orgId);
  const isSeller = !!user.orgId && p.project.developerId === user.orgId;
  if (!isBuyer && !isSeller && !isAdminRole(user.role)) throw forbidden();
  const viewerRole: SignerRole | null = isBuyer ? "BUYER" : isSeller ? "SELLER" : null;
  return { c, viewerRole };
}

function contractDto(c: Awaited<ReturnType<typeof loadContract>>["c"], viewerRole: SignerRole | null) {
  const signedRoles = new Set(c.signatures.map((s) => s.role));
  return {
    id: c.id,
    number: c.number,
    title: c.title,
    body: c.body,
    bodyHash: c.bodyHash,
    status: c.status,
    signedAt: c.signedAt,
    createdAt: c.createdAt,
    purchase: purchaseDto(c.purchase),
    signatures: c.signatures.map((s) => ({
      id: s.id,
      role: s.role,
      method: s.method,
      signerName: s.signerName,
      signerTin: s.signerTin,
      signerPinfl: s.signerPinfl,
      certSerial: s.certSerial,
      certValidTo: s.certValidTo,
      verified: s.verified,
      signedAt: s.signedAt,
    })),
    viewerRole,
    canSign: !!viewerRole && !signedRoles.has(viewerRole) && ["PENDING", "PARTIALLY_SIGNED"].includes(c.status) && c.purchase.status === "PENDING_SIGNATURES",
  };
}

export default async function buyerRoutes(app: FastifyInstance) {
  // ── create purchase (reserve unit + generate contract)
  app.post("/purchases", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const u = requireUser(req);
    const body = z.object({ projectId: z.string(), kind: z.enum(["UNIT", "DOCUMENT_PACKAGE"]), unitId: z.string().optional() }).parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: body.projectId }, include: { developer: true } });
    if (!project || !project.published) throw notFound("Obyekt topilmadi");
    if (u.orgId && project.developerId === u.orgId) throw badRequest("O'z obyektingizni sotib ololmaysiz");

    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { organization: true } });
    const buyerOrg = buyer.organization?.type === "BUYER_COMPANY" ? buyer.organization : null;

    let amount: Prisma.Decimal;
    let unit: Awaited<ReturnType<typeof prisma.unit.findUnique>> = null;
    if (body.kind === "UNIT") {
      if (!body.unitId) throw badRequest("Xonadon tanlanmagan");
      unit = await prisma.unit.findFirst({ where: { id: body.unitId, projectId: project.id } });
      if (!unit) throw notFound("Xonadon topilmadi");
      if (unit.status !== "AVAILABLE") throw conflict("Bu xonadon allaqachon band yoki sotilgan", "UNIT_NOT_AVAILABLE");
      amount = unit.price;
    } else {
      if (!project.packagePrice) throw badRequest("Bu obyekt uchun hujjatlar paketi sotilmaydi");
      const existing = await prisma.purchase.findFirst({
        where: { projectId: project.id, kind: "DOCUMENT_PACKAGE", buyerId: u.id, status: { notIn: ["CANCELLED"] } },
      });
      if (existing) throw conflict("Siz bu paketni allaqachon buyurtma qilgansiz", "ALREADY_PURCHASED");
      amount = project.packagePrice;
    }

    const template =
      (await prisma.contractTemplate.findFirst({ where: { key: DEFAULT_TEMPLATES[body.kind], active: true } })) ??
      (await prisma.contractTemplate.findFirst({ where: { kind: body.kind, active: true }, orderBy: { version: "desc" } }));
    if (!template) throw badRequest("Shartnoma shabloni topilmadi — administratorga murojaat qiling");

    const contractNumber = docNumber("C");
    const rendered = renderTemplate(
      template.body,
      contractContext({
        number: contractNumber,
        buyer: { fullName: buyer.fullName, phone: buyer.phone, pinfl: buyer.pinfl },
        buyerOrg: buyerOrg ? { name: buyerOrg.name, tin: buyerOrg.tin } : null,
        seller: { name: project.developer.legalName ?? project.developer.name, tin: project.developer.tin, director: project.developer.director, address: project.developer.address },
        project: { name: project.name, address: project.address, cadastreNumber: project.cadastreNumber },
        unit: unit ? { number: unit.number, floor: unit.floor, area: unit.area, rooms: unit.rooms, section: unit.section } : null,
        amount: Number(amount),
        currency: project.currency,
      }),
    );

    const purchase = await prisma.$transaction(async (tx) => {
      if (unit) {
        // atomic reservation: only one transaction can flip AVAILABLE → RESERVED
        const r = await tx.unit.updateMany({ where: { id: unit.id, status: "AVAILABLE" }, data: { status: "RESERVED" } });
        if (r.count !== 1) throw conflict("Bu xonadon hozirgina band qilindi", "UNIT_NOT_AVAILABLE");
      }
      return tx.purchase.create({
        data: {
          number: docNumber("P"),
          kind: body.kind,
          status: "PENDING_SIGNATURES",
          projectId: project.id,
          unitId: unit?.id,
          activeUnitLock: unit?.id, // DB-level unique guard against double selling
          buyerId: u.id,
          buyerOrgId: buyerOrg?.id,
          amount,
          currency: project.currency,
          contract: {
            create: {
              number: contractNumber,
              templateId: template.id,
              title: `${template.name} — ${project.name}${unit ? `, №${unit.number}` : ""}`,
              body: rendered,
              bodyHash: sha256(rendered),
              status: "PENDING",
            },
          },
        },
        include: purchaseInclude,
      });
    });

    void audit({
      actorId: u.id,
      action: "PURCHASE_CREATE",
      entity: "Purchase",
      entityId: purchase.id,
      ip: req.ip,
      meta: { number: purchase.number, kind: body.kind, unitId: unit?.id ?? null, amount: amount.toString(), contractHash: sha256(rendered) },
    });
    void publish("purchase.created", { purchaseId: purchase.id, projectId: project.id });
    void notifyOrgMembers(project.developerId, {
      type: "INFO",
      title: "Yangi buyurtma",
      body: `${buyer.fullName}: ${project.name}${unit ? ` — №${unit.number}` : " — hujjatlar paketi"}. Shartnomani imzolang.`,
      link: `/app/contracts/${purchase.contract!.id}`,
    });
    return { purchase: purchaseDto(purchase) };
  });

  app.get("/purchases", async (req) => {
    const u = requireUser(req);
    const rows = await prisma.purchase.findMany({
      where: { OR: [{ buyerId: u.id }, ...(u.orgId ? [{ buyerOrgId: u.orgId }] : [])] },
      include: purchaseInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(purchaseDto);
  });

  app.get<{ Params: { id: string } }>("/purchases/:id", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({ where: { id: req.params.id, ...purchaseVisibleTo(u) }, include: purchaseInclude });
    if (!p) throw notFound();
    return purchaseDto(p);
  });

  app.post<{ Params: { id: string } }>("/purchases/:id/cancel", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({ where: { id: req.params.id, ...purchaseVisibleTo(u) } });
    if (!p) throw notFound();
    if (!["DRAFT", "PENDING_SIGNATURES"].includes(p.status)) throw badRequest("Imzolangan bitimni bekor qilib bo'lmaydi");
    await prisma.$transaction([
      prisma.purchase.update({ where: { id: p.id }, data: { status: "CANCELLED", activeUnitLock: null } }),
      prisma.contract.updateMany({ where: { purchaseId: p.id }, data: { status: "CANCELLED" } }),
      ...(p.unitId ? [prisma.unit.updateMany({ where: { id: p.unitId, status: "RESERVED" }, data: { status: "AVAILABLE" } })] : []),
    ]);
    void audit({ actorId: u.id, action: "PURCHASE_CANCEL", entity: "Purchase", entityId: p.id, ip: req.ip });
    void publish("purchase.cancelled", { purchaseId: p.id, projectId: p.projectId });
    return { ok: true };
  });

  // demo payment — replace with Click / Payme / Uzum callbacks in production
  app.post<{ Params: { id: string } }>("/purchases/:id/pay", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({ where: { id: req.params.id, OR: [{ buyerId: u.id }, ...(u.orgId ? [{ buyerOrgId: u.orgId }] : [])] } });
    if (!p) throw notFound();
    if (p.status !== "SIGNED") throw badRequest("To'lov faqat ikki tomon imzolagandan so'ng amalga oshiriladi", "NOT_SIGNED");
    const status = p.kind === "DOCUMENT_PACKAGE" ? "COMPLETED" : "PAID";
    await prisma.$transaction([
      prisma.purchase.update({ where: { id: p.id }, data: { status, paidAt: new Date() } }),
      ...(p.unitId ? [prisma.unit.update({ where: { id: p.unitId }, data: { status: "SOLD" } })] : []),
    ]);
    void audit({ actorId: u.id, action: "PURCHASE_PAY", entity: "Purchase", entityId: p.id, ip: req.ip, meta: { amount: p.amount.toString() } });
    void publish("purchase.paid", { purchaseId: p.id, projectId: p.projectId });
    void notify(u.id, { type: "SUCCESS", title: "To'lov qabul qilindi", body: `Buyurtma ${p.number}. Hujjatlar endi siz uchun ochiq.`, link: `/app/purchases/${p.id}`, sms: true });
    const updated = await prisma.purchase.findUniqueOrThrow({ where: { id: p.id }, include: purchaseInclude });
    return purchaseDto(updated);
  });

  // ── contracts & E-IMZO
  app.get<{ Params: { id: string } }>("/contracts/:id", async (req) => {
    const u = requireUser(req);
    const { c, viewerRole } = await loadContract(req.params.id, u);
    return contractDto(c, viewerRole);
  });

  app.get<{ Params: { id: string } }>("/contracts/:id/challenge", async (req) => {
    const u = requireUser(req);
    const { c, viewerRole } = await loadContract(req.params.id, u);
    if (!viewerRole) throw forbidden("Siz bu shartnoma tomoni emassiz");
    const payload = signingPayload(c, viewerRole, u.id);
    return { ...payload, mode: env.EIMZO_MODE === "mock" ? "MOCK" : "EIMZO" };
  });

  app.post<{ Params: { id: string } }>("/contracts/:id/sign", async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const u = requireUser(req);
    const { method, pkcs7 } = z.object({ method: z.enum(["EIMZO", "MOCK"]), pkcs7: z.string().min(10).max(200_000) }).parse(req.body);
    const { c, viewerRole } = await loadContract(req.params.id, u);
    if (!viewerRole) throw forbidden("Siz bu shartnoma tomoni emassiz");
    if (!["PENDING", "PARTIALLY_SIGNED"].includes(c.status) || c.purchase.status !== "PENDING_SIGNATURES") throw badRequest("Shartnoma imzolash bosqichida emas");
    if (c.signatures.some((s) => s.role === viewerRole)) throw conflict("Siz allaqachon imzolagansiz", "ALREADY_SIGNED");
    // the stored body must still match its hash — any tampering blocks signing
    if (sha256(c.body) !== c.bodyHash) throw badRequest("Shartnoma matni o'zgartirilgan! Imzolash to'xtatildi", "BODY_TAMPERED");

    const payload = signingPayload(c, viewerRole, u.id);
    const v = await verifyPkcs7(pkcs7, { ip: req.ip, host: req.headers.host, expectedData: payload.data, mode: method });
    if (!v.ok) throw badRequest(v.reason ?? "Imzo tasdiqlanmadi", "SIGNATURE_INVALID");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { organization: true } });
    if (method === "EIMZO") {
      // the certificate must belong to the party: company TIN for legal entities, PINFL for individuals
      const org = viewerRole === "SELLER" ? user.organization : c.purchase.buyerOrg;
      if (org && v.signerTin && v.signerTin !== org.tin) throw badRequest("ERI sertifikati boshqa tashkilotga tegishli", "SIGNER_MISMATCH");
      if (!org && user.pinfl && v.signerPinfl && v.signerPinfl !== user.pinfl) throw badRequest("ERI sertifikati boshqa shaxsga tegishli", "SIGNER_MISMATCH");
    }

    await prisma.signature.create({
      data: {
        contractId: c.id,
        userId: u.id,
        role: viewerRole,
        method,
        pkcs7,
        certSerial: v.certSerial,
        signerName: v.signerName ?? user.fullName,
        signerTin: v.signerTin ?? (viewerRole === "SELLER" ? user.organization?.tin : c.purchase.buyerOrg?.tin) ?? null,
        signerPinfl: v.signerPinfl ?? user.pinfl,
        certValidTo: v.certValidTo,
        verified: true,
        verifyDetail: (v.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    const roles = new Set([...c.signatures.map((s) => s.role), viewerRole]);
    const complete = roles.has("BUYER") && roles.has("SELLER");
    await prisma.$transaction([
      prisma.contract.update({ where: { id: c.id }, data: { status: complete ? "SIGNED" : "PARTIALLY_SIGNED", signedAt: complete ? new Date() : undefined } }),
      ...(complete ? [prisma.purchase.update({ where: { id: c.purchaseId }, data: { status: "SIGNED" } })] : []),
    ]);

    void audit({
      actorId: u.id,
      action: "CONTRACT_SIGN",
      entity: "Contract",
      entityId: c.id,
      ip: req.ip,
      meta: { role: viewerRole, method, certSerial: v.certSerial ?? null, bodyHash: c.bodyHash, complete },
    });
    void publish(complete ? "contract.signed" : "contract.partially_signed", { contractId: c.id, purchaseId: c.purchaseId });
    if (viewerRole === "SELLER") {
      void notify(c.purchase.buyerId, {
        type: complete ? "SUCCESS" : "INFO",
        title: complete ? "Shartnoma to'liq imzolandi" : "Sotuvchi shartnomani imzoladi",
        body: `Shartnoma ${c.number}`,
        link: `/app/contracts/${c.id}`,
        sms: complete,
      });
    } else {
      void notifyOrgMembers(c.purchase.project.developerId, {
        type: complete ? "SUCCESS" : "INFO",
        title: complete ? "Shartnoma to'liq imzolandi" : "Xaridor shartnomani imzoladi",
        body: `Shartnoma ${c.number}`,
        link: `/app/contracts/${c.id}`,
      });
    }
    const fresh = await loadContract(c.id, u);
    return contractDto(fresh.c, fresh.viewerRole);
  });

  // ── my files / feed / notifications
  app.get("/me/files", async (req) => {
    const u = requireUser(req);
    const purchases = await prisma.purchase.findMany({
      where: { status: { in: ["PAID", "COMPLETED"] }, OR: [{ buyerId: u.id }, ...(u.orgId ? [{ buyerOrgId: u.orgId }] : [])] },
      select: { projectId: true },
      distinct: ["projectId"],
    });
    const projects = await prisma.project.findMany({
      where: { id: { in: purchases.map((p) => p.projectId) } },
      select: { id: true, slug: true, name: true, developerId: true, documents: { include: { file: true }, orderBy: { type: "asc" } } },
    });
    return Promise.all(
      projects.map(async (p) => {
        const access = await projectAccess(req.user, p);
        return { project: { slug: p.slug, name: p.name }, documents: p.documents.filter((d) => canSee(d.access, access)).map((d) => documentDto(d, true)) };
      }),
    );
  });

  app.get("/me/feed", async (req) => {
    const u = requireUser(req);
    const [purchased, favs] = await Promise.all([
      prisma.purchase.findMany({ where: { buyerId: u.id, status: { not: "CANCELLED" } }, select: { projectId: true } }),
      prisma.favorite.findMany({ where: { userId: u.id }, select: { projectId: true } }),
    ]);
    const ids = [...new Set([...purchased, ...favs].map((x) => x.projectId))];
    const posts = await prisma.progressUpdate.findMany({
      where: { projectId: { in: ids } },
      orderBy: { date: "desc" },
      take: 100,
      include: { author: { select: { fullName: true } }, media: { include: { file: true } }, project: { select: { slug: true, name: true } } },
    });
    return posts.map((p) => ({
      id: p.id,
      phase: p.phase,
      title: p.title,
      body: p.body,
      stage: p.stage,
      percent: p.percent,
      date: p.date,
      author: p.author,
      media: p.media.map((m) => fileRef(m.file)),
      project: p.project,
    }));
  });

  app.get("/notifications", async (req) => {
    const u = requireUser(req);
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { userId: u.id, readAt: null } }),
    ]);
    return { items, unread };
  });

  app.post("/notifications/read-all", async (req) => {
    const u = requireUser(req);
    await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/notifications/:id/read", async (req) => {
    const u = requireUser(req);
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: u.id }, data: { readAt: new Date() } });
    return { ok: true };
  });
}
