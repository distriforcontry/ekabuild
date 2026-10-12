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
import { PLAN_LIMITS, buildSchedule, dec, summarize } from "../lib/finance";
import { contractDocx } from "../lib/docx";
import { isAdminRole, requireUser, type AuthUser } from "../plugins/auth";
import { businessEvents } from "../lib/metrics";

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
    const body = z
      .object({
        projectId: z.string(),
        kind: z.enum(["UNIT", "DOCUMENT_PACKAGE"]),
        unitId: z.string().optional(),
        plan: z
          .object({
            planType: z.enum(["FULL", "INSTALLMENT"]),
            downPercent: z.number().int().min(PLAN_LIMITS.minDown).max(90).optional(),
            months: z.number().int().min(3).max(PLAN_LIMITS.maxMonths).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    const plan = body.kind === "UNIT" && body.plan?.planType === "INSTALLMENT" ? { planType: "INSTALLMENT" as const, downPercent: body.plan.downPercent ?? 30, months: body.plan.months ?? 12 } : { planType: "FULL" as const, downPercent: 100, months: 0 };
    const project = await prisma.project.findUnique({ where: { id: body.projectId }, include: { developer: true } });
    if (!project || !project.published) throw notFound("Obyekt topilmadi");
    if (project.archivedAt) throw badRequest("Obyekt arxivga olingan — sotuv to'xtatilgan", "PROJECT_ARCHIVED");
    if (project.developer.blockedAt) throw badRequest("Quruvchi faoliyati vaqtincha cheklangan — sotuv to'xtatilgan", "DEVELOPER_BLOCKED");
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
      (await prisma.contractTemplate.findFirst({ where: { kind: body.kind, active: true, NOT: { key: { startsWith: "annex-" } } }, orderBy: { version: "desc" } }));
    if (!template) throw badRequest("Shartnoma shabloni topilmadi — administratorga murojaat qiling");

    const contractNumber = docNumber("C");
    const schedule = buildSchedule(Number(amount), plan);
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
        payment: body.kind === "UNIT" ? { ...plan, rows: schedule } : null,
        reservationUntil: unit ? new Date(Date.now() + 7 * 86400_000) : null,
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
          planType: plan.planType,
          downPercent: plan.downPercent,
          months: plan.months,
          reservationUntil: unit ? new Date(Date.now() + 7 * 86400_000) : null,
          payments: { create: schedule.map((r) => ({ seq: r.seq, dueDate: r.dueDate, amount: dec(r.amount) })) },
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
    businessEvents.inc({ event: `purchase_${body.kind.toLowerCase()}` });
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
      prisma.payment.updateMany({ where: { purchaseId: p.id, status: { in: ["PENDING", "OVERDUE"] } }, data: { status: "CANCELLED" } }),
      ...(p.unitId ? [prisma.unit.updateMany({ where: { id: p.unitId, status: "RESERVED" }, data: { status: "AVAILABLE" } })] : []),
    ]);
    void audit({ actorId: u.id, action: "PURCHASE_CANCEL", entity: "Purchase", entityId: p.id, ip: req.ip });
    void publish("purchase.cancelled", { purchaseId: p.id, projectId: p.projectId });
    return { ok: true };
  });

  // ── payments (demo gateway — replace with Click / Payme / Uzum callbacks in production)
  app.get<{ Params: { id: string } }>("/purchases/:id/payments", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({ where: { id: req.params.id, ...purchaseVisibleTo(u) }, include: { payments: { orderBy: { seq: "asc" } } } });
    if (!p) throw notFound();
    const paid = p.payments.filter((x) => x.status === "PAID").reduce((s, x) => s + Number(x.amount), 0);
    const total = p.payments.reduce((s, x) => s + Number(x.amount), 0);
    const next = p.payments.find((x) => x.status !== "PAID" && x.status !== "CANCELLED");
    return {
      planType: p.planType,
      downPercent: p.downPercent,
      months: p.months,
      total: total.toFixed(2),
      paid: paid.toFixed(2),
      balance: (total - paid).toFixed(2),
      progress: total ? Math.round((paid / total) * 100) : 0,
      next: next ? { id: next.id, seq: next.seq, dueDate: next.dueDate, amount: next.amount.toFixed(2), status: next.status } : null,
      overdue: p.payments.filter((x) => x.status === "OVERDUE").length,
      items: p.payments.map((x) => ({ id: x.id, seq: x.seq, dueDate: x.dueDate, amount: x.amount.toFixed(2), status: x.status, paidAt: x.paidAt, method: x.method, reference: x.reference })),
    };
  });

  app.post<{ Params: { id: string } }>("/purchases/:id/pay", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({
      where: { id: req.params.id, OR: [{ buyerId: u.id }, ...(u.orgId ? [{ buyerOrgId: u.orgId }] : [])] },
      include: { payments: { orderBy: { seq: "asc" } } },
    });
    if (!p) throw notFound();
    if (!["SIGNED", "PAID"].includes(p.status)) throw badRequest("To'lov faqat ikki tomon imzolagandan so'ng amalga oshiriladi", "NOT_SIGNED");
    let payments = p.payments;
    if (!payments.length) {
      // legacy deals without a schedule: one full payment
      await prisma.payment.create({ data: { purchaseId: p.id, seq: 0, dueDate: new Date(), amount: p.amount } });
      payments = await prisma.payment.findMany({ where: { purchaseId: p.id }, orderBy: { seq: "asc" } });
    }
    const next = payments.find((x) => x.status === "PENDING" || x.status === "OVERDUE");
    if (!next) throw badRequest("Barcha to'lovlar amalga oshirilgan", "NOTHING_DUE");
    const reference = `DEMO-${Date.now().toString(36).toUpperCase()}`;
    const isLast = payments.filter((x) => x.status !== "PAID" && x.status !== "CANCELLED").length === 1;
    const first = !p.paidAt;
    await prisma.$transaction([
      prisma.payment.update({ where: { id: next.id }, data: { status: "PAID", paidAt: new Date(), method: "demo", reference } }),
      prisma.purchase.update({
        where: { id: p.id },
        data: {
          paidAt: p.paidAt ?? new Date(),
          status: isLast && (p.kind === "DOCUMENT_PACKAGE" || p.planType === "INSTALLMENT") ? "COMPLETED" : "PAID",
          reservationUntil: null,
        },
      }),
      ...(first && p.unitId ? [prisma.unit.update({ where: { id: p.unitId }, data: { status: "SOLD" } })] : []),
    ]);
    void audit({ actorId: u.id, action: "PAYMENT", entity: "Purchase", entityId: p.id, ip: req.ip, meta: { seq: next.seq, amount: next.amount.toString(), reference } });
    void publish("purchase.paid", { purchaseId: p.id, projectId: p.projectId, seq: next.seq });
    businessEvents.inc({ event: "purchase_paid" });
    void notify(u.id, {
      type: "SUCCESS",
      title: next.seq === 0 ? "To'lov qabul qilindi" : `${next.seq}-to'lov qabul qilindi`,
      body: `Buyurtma ${p.number}: ${Number(next.amount).toLocaleString("ru-RU")} so'm. ${first ? "Hujjatlar endi siz uchun ochiq." : ""}`,
      link: `/app/purchases/${p.id}`,
      sms: true,
    });
    const updated = await prisma.purchase.findUniqueOrThrow({ where: { id: p.id }, include: purchaseInclude });
    return purchaseDto(updated);
  });

  // instalment calculator (public — used on project pages before buying)
  app.get("/calc/installment", async (req) => {
    const q = z
      .object({
        amount: z.coerce.number().positive(),
        downPercent: z.coerce.number().int().min(PLAN_LIMITS.minDown).max(90).default(30),
        months: z.coerce.number().int().min(3).max(PLAN_LIMITS.maxMonths).default(12),
        ratePercent: z.coerce.number().min(0).max(60).default(0),
      })
      .parse(req.query);
    const rows = buildSchedule(q.amount, { planType: "INSTALLMENT", downPercent: q.downPercent, months: q.months, ratePercent: q.ratePercent });
    return { ...summarize(rows), limits: PLAN_LIMITS, schedule: rows.map((r) => ({ ...r, dueDate: r.dueDate.toISOString() })) };
  });

  // ── annexes (bron kelishuvi, to'lov jadvali, qabul-topshirish dalolatnomasi) — rendered from admin-managed templates
  app.get<{ Params: { id: string } }>("/purchases/:id/annexes", async (req) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({ where: { id: req.params.id, ...purchaseVisibleTo(u) }, select: { kind: true } });
    if (!p) throw notFound();
    const items = await prisma.contractTemplate.findMany({ where: { key: { startsWith: "annex-" }, kind: p.kind, active: true }, select: { key: true, name: true, version: true }, orderBy: { key: "asc" } });
    return items;
  });

  app.get<{ Params: { id: string; key: string }; Querystring: { format?: string } }>("/purchases/:id/annexes/:key", async (req, reply) => {
    const u = requireUser(req);
    const p = await prisma.purchase.findFirst({
      where: { id: req.params.id, ...purchaseVisibleTo(u) },
      include: {
        buyer: { select: { fullName: true, phone: true, pinfl: true } },
        buyerOrg: { select: { name: true, tin: true } },
        project: { include: { developer: true } },
        unit: true,
        contract: { include: { signatures: { orderBy: { signedAt: "asc" } } } },
        payments: { orderBy: { seq: "asc" } },
      },
    });
    if (!p) throw notFound();
    const t = req.params.key.startsWith("annex-") ? await prisma.contractTemplate.findFirst({ where: { key: req.params.key, active: true } }) : null;
    if (!t) throw notFound("Shablon topilmadi");
    const dev = p.project.developer;
    const body = renderTemplate(
      t.body,
      contractContext({
        number: p.contract?.number ?? p.number,
        date: p.contract?.createdAt ?? p.createdAt,
        buyer: p.buyer,
        buyerOrg: p.buyerOrg,
        seller: { name: dev.legalName ?? dev.name, tin: dev.tin, director: dev.director, address: dev.address },
        project: { name: p.project.name, address: p.project.address, cadastreNumber: p.project.cadastreNumber },
        unit: p.unit ? { number: p.unit.number, floor: p.unit.floor, area: p.unit.area, rooms: p.unit.rooms, section: p.unit.section } : null,
        amount: Number(p.amount),
        currency: p.currency,
        payment: p.payments.length ? { planType: p.planType, downPercent: p.downPercent, months: p.months, rows: p.payments.map((x) => ({ seq: x.seq, dueDate: x.dueDate, amount: Number(x.amount) })) } : null,
        reservationUntil: p.reservationUntil ?? new Date(p.createdAt.getTime() + 7 * 86400_000),
      }),
    );
    const hash = sha256(body);
    if (req.query.format === "md") return { key: t.key, title: t.name, version: t.version, body, bodyHash: hash };
    const buf = await contractDocx({
      title: t.name,
      number: `${p.contract?.number ?? p.number} · ${t.name}`,
      body,
      bodyHash: hash,
      signatures: p.contract?.signatures ?? [],
      note: p.contract ? `Ilova ${p.contract.number}-sonli shartnomaning ajralmas qismi bo'lib, shartnomaga qo'yilgan E-IMZO imzolari unga ham taalluqlidir.` : undefined,
    });
    void audit({ actorId: u.id, action: "ANNEX_DOWNLOAD", entity: "Purchase", entityId: p.id, ip: req.ip, meta: { key: t.key } });
    return reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("content-disposition", `attachment; filename="${p.number}-${t.key.replace(/^annex-/, "")}.docx"`)
      .send(buf);
  });

  // contract as DOCX (Word) with hash + signatures evidence block
  app.get<{ Params: { id: string } }>("/contracts/:id/docx", async (req, reply) => {
    const u = requireUser(req);
    const { c } = await loadContract(req.params.id, u);
    const buf = await contractDocx({ title: c.title, number: c.number, body: c.body, bodyHash: c.bodyHash, signatures: c.signatures });
    void audit({ actorId: u.id, action: "CONTRACT_DOWNLOAD", entity: "Contract", entityId: c.id, ip: req.ip });
    return reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("content-disposition", `attachment; filename="${c.number}.docx"`)
      .send(buf);
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
    businessEvents.inc({ event: `contract_signed_${method.toLowerCase()}` });
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
