import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { LABELS } from "@eka/shared";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../lib/audit";
import { publish } from "../lib/bus";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { notify, notifyOrgMembers } from "../lib/notify";
import { invalidate } from "../lib/redis";
import { paginate } from "../lib/serializers";
import { buildWorkbook, type XlsxColumn } from "../lib/xlsx";
import { isAdminRole, requireRole, type AuthUser } from "../plugins/auth";

/**
 * Control centre (nazorat): finance, payments, Excel exports, block / archive, deadlines and user activity.
 * Every endpoint exists twice: /admin/* (whole platform) and /dev/* (scoped to the developer's organisation).
 */

const DAY = 86400_000;
const money = "#,##0";
const dateFmt = "dd.mm.yyyy";
const dateTimeFmt = "dd.mm.yyyy hh:mm";
const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? null : Number(v));
const label = (group: keyof typeof LABELS, v: string | null | undefined) => (v ? ((LABELS[group] as Record<string, string>)[v] ?? v) : null);

type Scope = { admin: true } | { admin: false; orgId: string };

function scopeOf(req: FastifyRequest, area: "admin" | "dev"): { user: AuthUser; scope: Scope } {
  if (area === "admin") return { user: requireRole(req, "ADMIN"), scope: { admin: true } };
  const user = requireRole(req, "DEVELOPER", "ADMIN");
  if (isAdminRole(user.role) && !user.orgId) return { user, scope: { admin: true } };
  if (!user.orgId) throw forbidden("Quruvchi tashkiloti biriktirilmagan");
  return { user, scope: { admin: false, orgId: user.orgId } };
}

const projectScope = (s: Scope): Prisma.ProjectWhereInput => (s.admin ? {} : { developerId: s.orgId });
const purchaseScope = (s: Scope): Prisma.PurchaseWhereInput => (s.admin ? {} : { project: { developerId: s.orgId } });

/** `archived` query: absent / "0" → active only, "1" → archived only, "all" → both */
export function archivedFilter(v: string | undefined): { archivedAt?: Prisma.DateTimeNullableFilter | null } {
  if (v === "all") return {};
  if (v === "1" || v === "true") return { archivedAt: { not: null } };
  return { archivedAt: null };
}

const rangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  status: z.string().max(40).optional(),
  archived: z.string().max(5).optional(),
});

function createdRange(q: { from?: Date; to?: Date }, field = "createdAt") {
  if (!q.from && !q.to) return {};
  return { [field]: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: new Date(q.to.getTime() + DAY - 1) } : {}) } };
}

async function sendXlsx(reply: FastifyReply, name: string, buf: Buffer) {
  const stamp = new Date().toISOString().slice(0, 10);
  return reply
    .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("content-disposition", `attachment; filename="ekabuild-${name}-${stamp}.xlsx"`)
    .header("cache-control", "no-store")
    .send(buf);
}

// ───────────────────────────── exports ─────────────────────────────

const EXPORT_LIMIT = 50_000;
type ExportQuery = z.infer<typeof rangeQuery>;
type Exporter = (s: Scope, q: ExportQuery) => Promise<{ title: string; sheets: Parameters<typeof buildWorkbook>[0] }>;

function sheet<T>(name: string, title: string, columns: XlsxColumn<T>[], rows: T[]) {
  return { name, title, columns, rows } as unknown as Parameters<typeof buildWorkbook>[0][number];
}

const EXPORTS: Record<string, { adminOnly?: boolean; run: Exporter }> = {
  projects: {
    run: async (s, q) => {
      const rows = await prisma.project.findMany({
        where: { ...projectScope(s), ...archivedFilter(q.archived), ...(q.status ? { status: q.status as never } : {}), ...(q.q ? { name: { contains: q.q } } : {}), ...createdRange(q) },
        include: { developer: { select: { name: true, tin: true } }, _count: { select: { units: true, certificates: true, inspections: true, purchases: true } } },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Obyektlar",
        sheets: [
          sheet<R>("Obyektlar", "Qurilish obyektlari", [
            { header: "Nomi", key: "name", width: 32, value: (r) => r.name },
            { header: "Quruvchi", key: "dev", width: 28, value: (r) => r.developer.name },
            { header: "Quruvchi STIR", key: "tin", value: (r) => r.developer.tin },
            { header: "Viloyat", key: "region", width: 18, value: (r) => r.region },
            { header: "Manzil", key: "address", width: 40, value: (r) => r.address },
            { header: "Kadastr raqami", key: "cad", width: 22, value: (r) => r.cadastreNumber },
            { header: "Holat", key: "status", width: 18, value: (r) => label("projectStatus", r.status) },
            { header: "Tekshiruv", key: "ver", value: (r) => label("verification", r.verificationStatus) },
            { header: "E'lon qilingan", key: "pub", value: (r) => (r.published ? "Ha" : "Yo'q") },
            { header: "Trust Score", key: "trust", value: (r) => r.trustScore },
            { header: "Bajarilgan, %", key: "progress", value: (r) => r.progress },
            { header: "Qavatlar", key: "floors", value: (r) => r.floors },
            { header: "Xonadonlar", key: "units", value: (r) => r._count.units },
            { header: "Narx (dan)", key: "price", numFmt: money, value: (r) => num(r.priceFrom) },
            { header: "1 m² narxi", key: "sqm", numFmt: money, value: (r) => num(r.pricePerSqm) },
            { header: "Sertifikatlar", key: "certs", value: (r) => r._count.certificates },
            { header: "Inspeksiyalar", key: "insp", value: (r) => r._count.inspections },
            { header: "Bitimlar", key: "deals", value: (r) => r._count.purchases },
            { header: "Ko'rishlar", key: "views", value: (r) => r.views },
            { header: "Boshlanish", key: "start", numFmt: dateFmt, value: (r) => r.startDate },
            { header: "Reja bo'yicha topshirish", key: "end", numFmt: dateFmt, value: (r) => r.plannedEndDate },
            { header: "Arxivlangan", key: "arch", numFmt: dateFmt, value: (r) => r.archivedAt },
            { header: "Yaratilgan", key: "created", numFmt: dateFmt, value: (r) => r.createdAt },
          ], rows),
        ],
      };
    },
  },
  units: {
    run: async (s, q) => {
      const rows = await prisma.unit.findMany({
        where: { project: projectScope(s), ...(q.status ? { status: q.status as never } : {}) },
        include: { project: { select: { name: true } } },
        orderBy: [{ projectId: "asc" }, { section: "asc" }, { floor: "asc" }, { number: "asc" }],
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Xonadonlar",
        sheets: [
          sheet<R>("Xonadonlar", "Xonadonlar reyestri", [
            { header: "Obyekt", key: "p", width: 30, value: (r) => r.project.name },
            { header: "Blok", key: "s", value: (r) => r.section },
            { header: "Qavat", key: "f", value: (r) => r.floor },
            { header: "Raqam", key: "n", value: (r) => r.number },
            { header: "Xonalar", key: "rooms", value: (r) => r.rooms },
            { header: "Maydon, m²", key: "area", numFmt: "0.0", value: (r) => r.area },
            { header: "Narx", key: "price", numFmt: money, value: (r) => num(r.price) },
            { header: "Holat", key: "status", value: (r) => label("unitStatus", r.status) },
          ], rows),
        ],
      };
    },
  },
  purchases: {
    run: async (s, q) => {
      const rows = await prisma.purchase.findMany({
        where: { ...purchaseScope(s), ...(q.status ? { status: q.status as never } : {}), ...createdRange(q), ...(q.q ? { OR: [{ number: { contains: q.q } }, { buyer: { fullName: { contains: q.q } } }] } : {}) },
        include: {
          buyer: { select: { fullName: true, phone: true } },
          buyerOrg: { select: { name: true, tin: true } },
          project: { select: { name: true, developer: { select: { name: true } } } },
          unit: { select: { number: true, area: true, rooms: true } },
          contract: { select: { number: true, status: true } },
          payments: { select: { amount: true, status: true, dueDate: true } },
        },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      const paid = (r: R) => r.payments.filter((p) => p.status === "PAID").reduce((t, p) => t + Number(p.amount), 0);
      return {
        title: "Bitimlar",
        sheets: [
          sheet<R>("Bitimlar", "Bitimlar (xaridlar)", [
            { header: "Buyurtma", key: "num", width: 18, value: (r) => r.number },
            { header: "Sana", key: "date", numFmt: dateFmt, value: (r) => r.createdAt },
            { header: "Turi", key: "kind", width: 18, value: (r) => label("purchaseKind", r.kind) },
            { header: "Obyekt", key: "p", width: 28, value: (r) => r.project.name },
            { header: "Quruvchi", key: "dev", width: 24, value: (r) => r.project.developer.name },
            { header: "Xonadon", key: "unit", value: (r) => (r.unit ? `№${r.unit.number} · ${r.unit.rooms} xona · ${r.unit.area} m²` : null) },
            { header: "Xaridor", key: "buyer", width: 26, value: (r) => r.buyer.fullName },
            { header: "Telefon", key: "phone", width: 16, value: (r) => r.buyer.phone },
            { header: "Yuridik shaxs", key: "org", width: 24, value: (r) => r.buyerOrg?.name },
            { header: "STIR", key: "tin", value: (r) => r.buyerOrg?.tin },
            { header: "Summa", key: "amount", numFmt: money, value: (r) => num(r.amount) },
            { header: "To'lov rejasi", key: "plan", value: (r) => (r.planType === "INSTALLMENT" ? `Bo'lib to'lash · ${r.downPercent}% + ${r.months} oy` : "To'liq") },
            { header: "To'langan", key: "paid", numFmt: money, value: (r) => paid(r) },
            { header: "Qoldiq", key: "balance", numFmt: money, value: (r) => Number(r.amount) - paid(r) },
            { header: "Muddati o'tgan to'lovlar", key: "over", value: (r) => r.payments.filter((p) => p.status === "OVERDUE").length },
            { header: "Holat", key: "status", value: (r) => label("purchaseStatus", r.status) },
            { header: "Shartnoma", key: "c", width: 18, value: (r) => r.contract?.number },
            { header: "Shartnoma holati", key: "cs", value: (r) => label("contractStatus", r.contract?.status) },
          ], rows),
        ],
      };
    },
  },
  payments: {
    run: async (s, q) => {
      const rows = await prisma.payment.findMany({
        where: { purchase: purchaseScope(s), ...(q.status ? { status: q.status as never } : {}), ...createdRange(q, "dueDate") },
        include: { purchase: { select: { number: true, buyer: { select: { fullName: true, phone: true } }, project: { select: { name: true } } } } },
        orderBy: [{ dueDate: "asc" }],
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "To'lovlar",
        sheets: [
          sheet<R>("To'lovlar", "To'lovlar jadvali", [
            { header: "Buyurtma", key: "num", width: 18, value: (r) => r.purchase.number },
            { header: "Obyekt", key: "p", width: 28, value: (r) => r.purchase.project.name },
            { header: "Xaridor", key: "b", width: 26, value: (r) => r.purchase.buyer.fullName },
            { header: "Telefon", key: "ph", width: 16, value: (r) => r.purchase.buyer.phone },
            { header: "№", key: "seq", value: (r) => (r.seq === 0 ? "Boshlang'ich" : r.seq) },
            { header: "Muddat", key: "due", numFmt: dateFmt, value: (r) => r.dueDate },
            { header: "Summa", key: "amount", numFmt: money, value: (r) => num(r.amount) },
            { header: "Holat", key: "status", value: (r) => label("paymentStatus", r.status) },
            { header: "To'langan sana", key: "paidAt", numFmt: dateTimeFmt, value: (r) => r.paidAt },
            { header: "Usul", key: "m", value: (r) => r.method },
            { header: "Tranzaksiya", key: "ref", width: 20, value: (r) => r.reference },
          ], rows),
        ],
      };
    },
  },
  certificates: {
    run: async (s, q) => {
      const rows = await prisma.certificate.findMany({
        where: { project: projectScope(s), ...(q.status ? { status: q.status as never } : {}) },
        include: { project: { select: { name: true } } },
        orderBy: { validUntil: "asc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Sertifikatlar",
        sheets: [
          sheet<R>("Sertifikatlar", "Ruxsatnoma va sertifikatlar", [
            { header: "Obyekt", key: "p", width: 28, value: (r) => r.project.name },
            { header: "Turi", key: "t", width: 24, value: (r) => label("certificateType", r.type) },
            { header: "Raqam", key: "n", width: 20, value: (r) => r.number },
            { header: "Tekshiruv kodi", key: "c", width: 18, value: (r) => r.code },
            { header: "Bergan organ", key: "i", width: 32, value: (r) => r.issuer },
            { header: "Berilgan", key: "from", numFmt: dateFmt, value: (r) => r.issuedAt },
            { header: "Amal qiladi", key: "to", numFmt: dateFmt, value: (r) => r.validUntil },
            { header: "Qolgan kun", key: "left", value: (r) => (r.validUntil ? Math.ceil((r.validUntil.getTime() - Date.now()) / DAY) : null) },
            { header: "Holat", key: "s", value: (r) => label("certificateStatus", r.status) },
          ], rows),
        ],
      };
    },
  },
  documents: {
    run: async (s, q) => {
      const rows = await prisma.document.findMany({
        where: { project: projectScope(s), ...archivedFilter(q.archived), ...(q.status ? { status: q.status as never } : {}) },
        include: { project: { select: { name: true } }, file: { select: { originalName: true, size: true, sha256: true } } },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Hujjatlar",
        sheets: [
          sheet<R>("Hujjatlar", "Loyiha hujjatlari", [
            { header: "Obyekt", key: "p", width: 28, value: (r) => r.project.name },
            { header: "Nomi", key: "t", width: 36, value: (r) => r.title },
            { header: "Turi", key: "ty", width: 22, value: (r) => label("documentType", r.type) },
            { header: "Raqam", key: "n", value: (r) => r.number },
            { header: "Kirish", key: "a", value: (r) => label("access", r.access) },
            { header: "Holat", key: "s", value: (r) => label("verification", r.status) },
            { header: "Fayl", key: "f", width: 30, value: (r) => r.file.originalName },
            { header: "Hajmi, KB", key: "kb", value: (r) => Math.round(r.file.size / 1024) },
            { header: "SHA-256", key: "h", width: 66, value: (r) => r.file.sha256 },
            { header: "Arxivlangan", key: "arch", numFmt: dateFmt, value: (r) => r.archivedAt },
            { header: "Yuklangan", key: "c", numFmt: dateFmt, value: (r) => r.createdAt },
          ], rows),
        ],
      };
    },
  },
  users: {
    adminOnly: true,
    run: async (_s, q) => {
      const rows = await prisma.user.findMany({
        where: { ...(q.status ? { status: q.status as never } : {}), ...createdRange(q), ...(q.q ? { OR: [{ fullName: { contains: q.q } }, { phone: { contains: q.q } }] } : {}) },
        include: { organization: { select: { name: true } }, _count: { select: { purchases: true } } },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Foydalanuvchilar",
        sheets: [
          sheet<R>("Foydalanuvchilar", "Foydalanuvchilar", [
            { header: "F.I.Sh.", key: "n", width: 28, value: (r) => r.fullName },
            { header: "Telefon", key: "p", width: 16, value: (r) => r.phone },
            { header: "E-mail", key: "e", width: 24, value: (r) => r.email },
            { header: "Rol", key: "r", value: (r) => label("role", r.role) },
            { header: "Tashkilot", key: "o", width: 26, value: (r) => r.organization?.name },
            { header: "Holat", key: "s", value: (r) => (r.status === "BLOCKED" ? "Bloklangan" : "Faol") },
            { header: "Bloklash sababi", key: "br", width: 30, value: (r) => r.blockReason },
            { header: "Telefon tasdiqlangan", key: "v", numFmt: dateFmt, value: (r) => r.phoneVerifiedAt },
            { header: "Bitimlar", key: "d", value: (r) => r._count.purchases },
            { header: "Oxirgi kirish", key: "l", numFmt: dateTimeFmt, value: (r) => r.lastLoginAt },
            { header: "Ro'yxatdan o'tgan", key: "c", numFmt: dateFmt, value: (r) => r.createdAt },
          ], rows),
        ],
      };
    },
  },
  organizations: {
    adminOnly: true,
    run: async (_s, q) => {
      const rows = await prisma.organization.findMany({
        where: { ...archivedFilter(q.archived), ...(q.status ? { status: q.status as never } : {}) },
        include: { _count: { select: { members: true, projects: true } } },
        orderBy: { name: "asc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Tashkilotlar",
        sheets: [
          sheet<R>("Tashkilotlar", "Tashkilotlar", [
            { header: "Nomi", key: "n", width: 30, value: (r) => r.name },
            { header: "Yuridik nomi", key: "l", width: 34, value: (r) => r.legalName },
            { header: "Turi", key: "t", value: (r) => label("orgType", r.type) },
            { header: "STIR", key: "tin", value: (r) => r.tin },
            { header: "Direktor", key: "d", width: 24, value: (r) => r.director },
            { header: "Telefon", key: "p", width: 16, value: (r) => r.phone },
            { header: "Viloyat", key: "reg", value: (r) => r.region },
            { header: "Litsenziya", key: "lic", value: (r) => r.licenseNumber },
            { header: "Holat", key: "s", value: (r) => label("verification", r.status) },
            { header: "Bloklangan", key: "b", numFmt: dateFmt, value: (r) => r.blockedAt },
            { header: "Bloklash sababi", key: "br", width: 30, value: (r) => r.blockReason },
            { header: "A'zolar", key: "m", value: (r) => r._count.members },
            { header: "Obyektlar", key: "pr", value: (r) => r._count.projects },
            { header: "Arxivlangan", key: "a", numFmt: dateFmt, value: (r) => r.archivedAt },
            { header: "Yaratilgan", key: "c", numFmt: dateFmt, value: (r) => r.createdAt },
          ], rows),
        ],
      };
    },
  },
  complaints: {
    adminOnly: true,
    run: async (_s, q) => {
      const rows = await prisma.complaint.findMany({
        where: { ...archivedFilter(q.archived), ...(q.status ? { status: q.status as never } : {}), ...createdRange(q) },
        include: { project: { select: { name: true } }, reporter: { select: { fullName: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Shikoyatlar",
        sheets: [
          sheet<R>("Shikoyatlar", "Shikoyat va murojaatlar", [
            { header: "Sana", key: "c", numFmt: dateTimeFmt, value: (r) => r.createdAt },
            { header: "Obyekt", key: "p", width: 26, value: (r) => r.project?.name },
            { header: "Toifa", key: "cat", width: 20, value: (r) => label("complaintCategory", r.category) },
            { header: "Murojaat", key: "s", width: 50, value: (r) => r.message },
            { header: "Murojaatchi", key: "u", width: 24, value: (r) => r.reporter?.fullName ?? "Anonim" },
            { header: "Aloqa", key: "ph", width: 18, value: (r) => r.reporter?.phone ?? r.contact },
            { header: "Holat", key: "st", value: (r) => label("complaintStatus", r.status) },
            { header: "Javob", key: "a", width: 40, value: (r) => r.resolution },
            { header: "Arxivlangan", key: "ar", numFmt: dateFmt, value: (r) => r.archivedAt },
          ], rows),
        ],
      };
    },
  },
  audit: {
    adminOnly: true,
    run: async (_s, q) => {
      const rows = await prisma.auditLog.findMany({
        where: { ...createdRange(q), ...(q.q ? { OR: [{ action: { contains: q.q } }, { entity: { contains: q.q } }] } : {}) },
        include: { actor: { select: { fullName: true, phone: true } } },
        orderBy: { id: "desc" },
        take: EXPORT_LIMIT,
      });
      type R = (typeof rows)[number];
      return {
        title: "Audit",
        sheets: [
          sheet<R>("Audit", "Audit jurnali (hash-zanjir)", [
            { header: "#", key: "id", value: (r) => Number(r.id) },
            { header: "Vaqt", key: "t", numFmt: dateTimeFmt, value: (r) => r.createdAt },
            { header: "Foydalanuvchi", key: "a", width: 24, value: (r) => r.actor?.fullName ?? "tizim" },
            { header: "Amal", key: "ac", width: 22, value: (r) => r.action },
            { header: "Obyekt turi", key: "e", value: (r) => r.entity },
            { header: "ID", key: "eid", width: 28, value: (r) => r.entityId },
            { header: "IP", key: "ip", value: (r) => r.ip },
            { header: "Ma'lumot", key: "m", width: 50, value: (r) => (r.meta ? JSON.stringify(r.meta) : null) },
            { header: "Xesh", key: "h", width: 66, value: (r) => r.hash },
          ], rows),
        ],
      };
    },
  },
};

// ───────────────────────────── finance ─────────────────────────────

async function finance(s: Scope, months: number) {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const pScope = purchaseScope(s);
  const live: Prisma.PurchaseWhereInput = { ...pScope, status: { notIn: ["CANCELLED", "DRAFT"] } };
  const [deals, payments, upcoming, overdueRows, byPlan] = await Promise.all([
    prisma.purchase.aggregate({ where: live, _sum: { amount: true }, _count: true }),
    prisma.payment.groupBy({ by: ["status"], where: { purchase: live }, _sum: { amount: true }, _count: true }),
    prisma.payment.findMany({
      where: { purchase: live, status: "PENDING", dueDate: { lte: new Date(now.getTime() + 30 * DAY) } },
      include: { purchase: { select: { id: true, number: true, buyer: { select: { fullName: true, phone: true } }, project: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { purchase: live, status: "OVERDUE" },
      include: { purchase: { select: { id: true, number: true, buyer: { select: { fullName: true, phone: true } }, project: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.purchase.groupBy({ by: ["planType"], where: { ...live, kind: "UNIT" }, _count: true, _sum: { amount: true } }),
  ]);
  const sum = (st: string) => Number(payments.find((p) => p.status === st)?._sum.amount ?? 0);
  const cnt = (st: string) => payments.find((p) => p.status === st)?._count ?? 0;

  // monthly cash: collected (paidAt) vs scheduled (dueDate)
  const [paidRows, dueRows] = await Promise.all([
    prisma.payment.findMany({ where: { purchase: pScope, status: "PAID", paidAt: { gte: since } }, select: { paidAt: true, amount: true } }),
    prisma.payment.findMany({ where: { purchase: live, dueDate: { gte: since, lte: new Date(now.getFullYear(), now.getMonth() + 7, 0) } }, select: { dueDate: true, amount: true, status: true } }),
  ]);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthly = new Map<string, { month: string; collected: number; scheduled: number; overdue: number }>();
  for (let i = 0; i < months + 6; i++) {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    monthly.set(key(d), { month: key(d), collected: 0, scheduled: 0, overdue: 0 });
  }
  for (const p of paidRows) monthly.get(key(p.paidAt!))!.collected += Number(p.amount);
  for (const p of dueRows) {
    const m = monthly.get(key(p.dueDate));
    if (!m) continue;
    m.scheduled += Number(p.amount);
    if (p.status === "OVERDUE") m.overdue += Number(p.amount);
  }

  // per-project receivables
  const perProject = await prisma.payment.groupBy({ by: ["purchaseId", "status"], where: { purchase: live }, _sum: { amount: true } });
  const purchaseIds = [...new Set(perProject.map((r) => r.purchaseId))];
  const purchaseProject = new Map(
    (await prisma.purchase.findMany({ where: { id: { in: purchaseIds } }, select: { id: true, project: { select: { id: true, name: true } } } })).map((p) => [p.id, p.project]),
  );
  const byProject = new Map<string, { id: string; name: string; contracted: number; collected: number; overdue: number }>();
  for (const r of perProject) {
    const pr = purchaseProject.get(r.purchaseId);
    if (!pr) continue;
    const row = byProject.get(pr.id) ?? { id: pr.id, name: pr.name, contracted: 0, collected: 0, overdue: 0 };
    const v = Number(r._sum.amount ?? 0);
    if (r.status !== "CANCELLED") row.contracted += v;
    if (r.status === "PAID") row.collected += v;
    if (r.status === "OVERDUE") row.overdue += v;
    byProject.set(pr.id, row);
  }

  const contracted = Number(deals._sum.amount ?? 0);
  const collected = sum("PAID");
  const payRow = (p: (typeof upcoming)[number]) => ({
    id: p.id,
    seq: p.seq,
    dueDate: p.dueDate,
    amount: p.amount.toFixed(2),
    status: p.status,
    daysLeft: Math.ceil((p.dueDate.getTime() - now.getTime()) / DAY),
    purchase: { id: p.purchase.id, number: p.purchase.number, projectName: p.purchase.project.name, buyerName: p.purchase.buyer.fullName, buyerPhone: p.purchase.buyer.phone },
  });
  return {
    totals: {
      deals: deals._count,
      contracted,
      collected,
      receivable: sum("PENDING") + sum("OVERDUE"),
      overdue: sum("OVERDUE"),
      overdueCount: cnt("OVERDUE"),
      pendingCount: cnt("PENDING"),
      collectionRate: contracted ? Math.round((collected / contracted) * 1000) / 10 : 0,
    },
    byPlan: byPlan.map((p) => ({ planType: p.planType, count: p._count, amount: Number(p._sum.amount ?? 0) })),
    monthly: [...monthly.values()],
    byProject: [...byProject.values()].sort((a, b) => b.contracted - a.contracted).slice(0, 12),
    upcoming: upcoming.map(payRow),
    overdue: overdueRows.map(payRow),
  };
}

// ───────────────────────────── deadlines ─────────────────────────────

type Deadline = {
  id: string;
  kind: "certificate" | "project" | "reservation" | "payment" | "contract" | "complaint" | "document";
  severity: "overdue" | "critical" | "soon";
  dueDate: string;
  daysLeft: number;
  title: string;
  subtitle: string;
  link: string;
};

async function deadlines(s: Scope, horizonDays: number): Promise<{ items: Deadline[]; summary: Record<string, number> }> {
  const now = Date.now();
  const horizon = new Date(now + horizonDays * DAY);
  const pScope = projectScope(s);
  const base = s.admin ? "/admin" : "/app/developer";
  const [certs, projects, reservations, payments, contracts, complaints, docs] = await Promise.all([
    prisma.certificate.findMany({ where: { project: { ...pScope, archivedAt: null }, status: { in: ["VERIFIED", "PENDING", "EXPIRED"] }, validUntil: { lte: horizon } }, include: { project: { select: { id: true, name: true } } }, take: 200 }),
    prisma.project.findMany({ where: { ...pScope, archivedAt: null, status: { in: ["PLANNING", "PERMITTED", "UNDER_CONSTRUCTION"] }, plannedEndDate: { lte: horizon } }, select: { id: true, name: true, plannedEndDate: true, progress: true }, take: 200 }),
    prisma.purchase.findMany({ where: { project: pScope, status: { in: ["PENDING_SIGNATURES", "SIGNED"] }, paidAt: null, reservationUntil: { not: null, lte: horizon } }, include: { buyer: { select: { fullName: true } }, unit: { select: { number: true } }, project: { select: { name: true } } }, take: 200 }),
    prisma.payment.findMany({ where: { purchase: { project: pScope, status: { notIn: ["CANCELLED"] } }, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lte: new Date(now + Math.min(horizonDays, 14) * DAY) } }, include: { purchase: { select: { id: true, number: true, buyer: { select: { fullName: true } }, project: { select: { name: true } } } } }, orderBy: { dueDate: "asc" }, take: 300 }),
    prisma.contract.findMany({ where: { purchase: { project: pScope, status: { in: ["PENDING_SIGNATURES", "SIGNED"] } }, status: { in: ["PENDING", "PARTIALLY_SIGNED"] }, createdAt: { lte: new Date(now - 2 * DAY) } }, include: { purchase: { select: { id: true, number: true, project: { select: { name: true } } } } }, take: 200 }),
    s.admin ? prisma.complaint.findMany({ where: { archivedAt: null, status: { in: ["OPEN", "IN_REVIEW"] } }, include: { project: { select: { name: true } } }, take: 200 }) : Promise.resolve([]),
    prisma.document.findMany({ where: { project: pScope, archivedAt: null, status: "PENDING" }, include: { project: { select: { id: true, name: true } } }, take: 200 }),
  ]);

  const items: Deadline[] = [];
  const push = (d: Omit<Deadline, "severity" | "daysLeft" | "dueDate"> & { due: Date; criticalDays?: number }) => {
    const daysLeft = Math.ceil((d.due.getTime() - now) / DAY);
    const severity = daysLeft < 0 ? "overdue" : daysLeft <= (d.criticalDays ?? 7) ? "critical" : "soon";
    const { due, criticalDays: _c, ...rest } = d;
    items.push({ ...rest, dueDate: due.toISOString(), daysLeft, severity });
  };

  for (const c of certs)
    push({ id: c.id, kind: "certificate", due: c.validUntil!, criticalDays: 30, title: `${label("certificateType", c.type)} № ${c.number}`, subtitle: c.project.name, link: s.admin ? `/admin/certificates?q=${encodeURIComponent(c.number)}` : `${base}/projects/${c.project.id}` });
  for (const p of projects)
    push({ id: p.id, kind: "project", due: p.plannedEndDate!, criticalDays: 30, title: p.name, subtitle: `Reja bo'yicha topshirish · bajarilgan ${p.progress}%`, link: s.admin ? `/admin/projects?q=${encodeURIComponent(p.name)}` : `${base}/projects/${p.id}` });
  for (const r of reservations)
    push({ id: r.id, kind: "reservation", due: r.reservationUntil!, criticalDays: 2, title: `Bron · ${r.project.name}${r.unit ? ` · №${r.unit.number}` : ""}`, subtitle: `${r.number} · ${r.buyer.fullName}`, link: s.admin ? `/admin/purchases?q=${r.number}` : `${base}/sales` });
  for (const p of payments)
    push({ id: p.id, kind: "payment", due: p.dueDate, criticalDays: 3, title: `${p.seq === 0 ? "Boshlang'ich to'lov" : `${p.seq}-to'lov`} · ${Number(p.amount).toLocaleString("ru-RU")} so'm`, subtitle: `${p.purchase.number} · ${p.purchase.project.name} · ${p.purchase.buyer.fullName}`, link: s.admin ? `/admin/finance?q=${p.purchase.number}` : `${base}/finance` });
  for (const c of contracts)
    push({ id: c.id, kind: "contract", due: new Date(c.createdAt.getTime() + 5 * DAY), criticalDays: 2, title: `Shartnoma № ${c.number} imzolanmagan`, subtitle: c.purchase.project.name, link: s.admin ? `/admin/purchases?q=${c.purchase.number}` : `${base}/sales` });
  for (const c of complaints)
    push({ id: c.id, kind: "complaint", due: new Date(c.createdAt.getTime() + 5 * DAY), criticalDays: 2, title: `${label("complaintCategory", c.category)}: ${c.message.slice(0, 60)}${c.message.length > 60 ? "…" : ""}`, subtitle: c.project?.name ?? "Umumiy murojaat", link: `/admin/complaints` });
  for (const d of docs)
    push({ id: d.id, kind: "document", due: new Date(d.createdAt.getTime() + 3 * DAY), criticalDays: 1, title: d.title, subtitle: `${d.project.name} · tekshiruv kutilmoqda`, link: s.admin ? `/admin/documents` : `${base}/projects/${d.project.id}` });

  items.sort((a, b) => a.daysLeft - b.daysLeft);
  const summary: Record<string, number> = { overdue: 0, critical: 0, soon: 0 };
  for (const i of items) {
    summary[i.severity] = (summary[i.severity] ?? 0) + 1;
    summary[i.kind] = (summary[i.kind] ?? 0) + 1;
  }
  return { items, summary };
}

// ───────────────────────────── routes ─────────────────────────────

const paymentsQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["dueDate", "amount", "paidAt", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export default async function controlRoutes(app: FastifyInstance) {
  for (const area of ["admin", "dev"] as const) {
    app.get(`/${area}/finance`, async (req) => {
      const { scope } = scopeOf(req, area);
      const { months } = z.object({ months: z.coerce.number().int().min(3).max(36).default(12) }).parse(req.query);
      return finance(scope, months);
    });

    app.get(`/${area}/payments`, async (req) => {
      const { scope } = scopeOf(req, area);
      const q = paymentsQuery.parse(req.query);
      const { page, pageSize, skip, take } = paginate(q);
      const where: Prisma.PaymentWhereInput = {
        purchase: { ...purchaseScope(scope), ...(q.q ? { OR: [{ number: { contains: q.q } }, { buyer: { fullName: { contains: q.q } } }, { buyer: { phone: { contains: q.q } } }, { project: { name: { contains: q.q } } }] } : {}) },
        ...(q.status ? { status: q.status } : {}),
        ...createdRange(q, "dueDate"),
      };
      const [rows, total, agg] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take,
          include: { purchase: { select: { id: true, number: true, planType: true, buyer: { select: { fullName: true, phone: true } }, project: { select: { id: true, name: true } } } } },
          orderBy: q.sort ? { [q.sort]: q.order ?? "asc" } : [{ status: "asc" }, { dueDate: "asc" }],
        }),
        prisma.payment.count({ where }),
        prisma.payment.aggregate({ where, _sum: { amount: true } }),
      ]);
      return {
        items: rows.map((p) => ({
          id: p.id,
          seq: p.seq,
          dueDate: p.dueDate,
          amount: p.amount.toFixed(2),
          status: p.status,
          paidAt: p.paidAt,
          method: p.method,
          reference: p.reference,
          daysLeft: Math.ceil((p.dueDate.getTime() - Date.now()) / DAY),
          purchase: { id: p.purchase.id, number: p.purchase.number, planType: p.purchase.planType, projectId: p.purchase.project.id, projectName: p.purchase.project.name, buyerName: p.purchase.buyer.fullName, buyerPhone: p.purchase.buyer.phone },
        })),
        total,
        page,
        pageSize,
        sum: Number(agg._sum.amount ?? 0).toFixed(2),
      };
    });

    // manual reconciliation: bank transfer received outside the platform
    app.post<{ Params: { id: string } }>(`/${area}/payments/:id/mark-paid`, async (req) => {
      const { user, scope } = scopeOf(req, area);
      const body = z.object({ reference: z.string().trim().min(3).max(64), method: z.enum(["bank", "cash", "click", "payme", "uzum"]).default("bank"), paidAt: z.coerce.date().optional() }).parse(req.body);
      const pay = await prisma.payment.findFirst({ where: { id: req.params.id, purchase: purchaseScope(scope) }, include: { purchase: { include: { payments: true } } } });
      if (!pay) throw notFound();
      if (pay.status === "PAID") throw badRequest("To'lov allaqachon qayd etilgan", "ALREADY_PAID");
      if (pay.status === "CANCELLED") throw badRequest("Bekor qilingan to'lov");
      const p = pay.purchase;
      if (!["SIGNED", "PAID"].includes(p.status)) throw badRequest("Shartnoma hali imzolanmagan", "NOT_SIGNED");
      const remaining = p.payments.filter((x) => x.status !== "PAID" && x.status !== "CANCELLED").length;
      await prisma.$transaction([
        prisma.payment.update({ where: { id: pay.id }, data: { status: "PAID", paidAt: body.paidAt ?? new Date(), method: body.method, reference: body.reference } }),
        prisma.purchase.update({ where: { id: p.id }, data: { paidAt: p.paidAt ?? new Date(), status: remaining === 1 && p.planType === "INSTALLMENT" ? "COMPLETED" : "PAID", reservationUntil: null } }),
        ...(!p.paidAt && p.unitId ? [prisma.unit.update({ where: { id: p.unitId }, data: { status: "SOLD" } })] : []),
      ]);
      void audit({ actorId: user.id, action: "PAYMENT_RECONCILE", entity: "Payment", entityId: pay.id, ip: req.ip, meta: { purchase: p.number, seq: pay.seq, amount: pay.amount.toString(), ...body } });
      void notify(p.buyerId, { type: "SUCCESS", title: "To'lov qayd etildi", body: `${p.number}: ${Number(pay.amount).toLocaleString("ru-RU")} so'm (${body.reference})`, link: `/app/purchases/${p.id}`, sms: true });
      return { ok: true };
    });

    app.get<{ Params: { entity: string } }>(`/${area}/export/:entity`, async (req, reply) => {
      const { user, scope } = scopeOf(req, area);
      const exp = EXPORTS[req.params.entity];
      if (!exp) throw notFound("Eksport turi topilmadi");
      if (exp.adminOnly && !scope.admin) throw forbidden();
      const q = rangeQuery.parse(req.query);
      const { title, sheets } = await exp.run(scope, q);
      const buf = await buildWorkbook(sheets);
      void audit({ actorId: user.id, action: "EXPORT", entity: title, ip: req.ip, meta: { entity: req.params.entity, rows: sheets.reduce((t, s) => t + s.rows.length, 0), filters: q } });
      return sendXlsx(reply, req.params.entity, buf);
    });

    app.get(`/${area}/deadlines`, async (req) => {
      const { scope } = scopeOf(req, area);
      const { days } = z.object({ days: z.coerce.number().int().min(7).max(365).default(60) }).parse(req.query);
      return deadlines(scope, days);
    });
  }

  app.get("/dev/export", async (req) => {
    scopeOf(req, "dev");
    return Object.entries(EXPORTS).filter(([, e]) => !e.adminOnly).map(([k]) => k);
  });
  app.get("/admin/export", async (req) => {
    scopeOf(req, "admin");
    return Object.keys(EXPORTS);
  });

  // ── block / archive (admin)
  const reason = z.string().trim().min(3).max(512);

  app.post<{ Params: { id: string } }>("/admin/organizations/:id/block", async (req) => {
    const { user } = scopeOf(req, "admin");
    const body = z.object({ blocked: z.boolean(), reason: reason.optional() }).parse(req.body);
    if (body.blocked && !body.reason) throw badRequest("Bloklash sababini kiriting", "REASON_REQUIRED");
    const org = await prisma.organization.update({ where: { id: req.params.id }, data: body.blocked ? { blockedAt: new Date(), blockReason: body.reason } : { blockedAt: null, blockReason: null } });
    void audit({ actorId: user.id, action: body.blocked ? "ORG_BLOCK" : "ORG_UNBLOCK", entity: "Organization", entityId: org.id, ip: req.ip, meta: { reason: body.reason, tin: org.tin } });
    void notifyOrgMembers(org.id, {
      type: body.blocked ? "DANGER" : "SUCCESS",
      title: body.blocked ? "Tashkilot faoliyati cheklandi" : "Cheklov olib tashlandi",
      body: body.blocked ? `Sabab: ${body.reason}. Obyektlaringiz katalogdan vaqtincha olindi, yangi sotuvlar to'xtatildi.` : "Obyektlaringiz katalogda qayta ko'rinadi.",
      sms: true,
    });
    await invalidate("projects:map", "stats:public");
    return { id: org.id, blockedAt: org.blockedAt, blockReason: org.blockReason };
  });

  app.post<{ Params: { entity: string; id: string } }>("/admin/:entity/:id/archive", async (req) => {
    const { user } = scopeOf(req, "admin");
    const body = z.object({ archived: z.boolean(), reason: z.string().trim().max(512).optional() }).parse(req.body);
    const archivedAt = body.archived ? new Date() : null;
    let res: { id: string; archivedAt: Date | null };
    switch (req.params.entity) {
      case "projects":
        res = await prisma.project.update({ where: { id: req.params.id }, data: { archivedAt, ...(body.archived ? { featured: false } : {}) }, select: { id: true, archivedAt: true } });
        await invalidate("projects:map", "stats:public");
        void publish("trust.recalculate", { projectId: res.id });
        break;
      case "organizations":
        res = await prisma.organization.update({ where: { id: req.params.id }, data: { archivedAt }, select: { id: true, archivedAt: true } });
        await invalidate("projects:map", "stats:public");
        break;
      case "documents":
        res = await prisma.document.update({ where: { id: req.params.id }, data: { archivedAt }, select: { id: true, archivedAt: true } });
        break;
      case "complaints":
        res = await prisma.complaint.update({ where: { id: req.params.id }, data: { archivedAt }, select: { id: true, archivedAt: true } });
        break;
      default:
        throw notFound("Noma'lum obyekt turi");
    }
    void audit({ actorId: user.id, action: body.archived ? "ARCHIVE" : "UNARCHIVE", entity: req.params.entity, entityId: res.id, ip: req.ip, meta: { reason: body.reason } });
    return res;
  });

  // developer archives own project (e.g. sold out / handed over long ago) — evidence stays for buyers
  app.post<{ Params: { id: string } }>("/dev/projects/:id/archive", async (req) => {
    const { user, scope } = scopeOf(req, "dev");
    const body = z.object({ archived: z.boolean() }).parse(req.body);
    const p = await prisma.project.findFirst({ where: { id: req.params.id, ...projectScope(scope) } });
    if (!p) throw notFound();
    if (body.archived) {
      const open = await prisma.purchase.count({ where: { projectId: p.id, status: { in: ["PENDING_SIGNATURES", "SIGNED"] } } });
      if (open) throw badRequest(`Ochiq bitimlar bor (${open}) — avval ularni yakunlang`, "OPEN_DEALS");
    }
    const res = await prisma.project.update({ where: { id: p.id }, data: { archivedAt: body.archived ? new Date() : null, ...(body.archived ? { featured: false } : {}) }, select: { id: true, archivedAt: true } });
    void audit({ actorId: user.id, action: body.archived ? "ARCHIVE" : "UNARCHIVE", entity: "projects", entityId: p.id, ip: req.ip });
    await invalidate("projects:map", "stats:public");
    return res;
  });

  // ── user activity profile (admin)
  app.get<{ Params: { id: string } }>("/admin/users/:id/activity", async (req) => {
    scopeOf(req, "admin");
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        blockReason: true,
        createdAt: true,
        lastLoginAt: true,
        phoneVerifiedAt: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });
    if (!u) throw notFound();
    const since = new Date(Date.now() - 90 * DAY);
    const [sessions, events, auditRows, purchases, threads, favorites, eventsByType] = await Promise.all([
      prisma.session.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true, revokedAt: true } }),
      prisma.activityEvent.findMany({ where: { userId: u.id, createdAt: { gte: since } }, select: { type: true, createdAt: true, projectId: true, meta: true }, orderBy: { createdAt: "desc" }, take: 2000 }),
      prisma.auditLog.findMany({ where: { actorId: u.id }, orderBy: { id: "desc" }, take: 40, select: { id: true, action: true, entity: true, entityId: true, createdAt: true, ip: true } }),
      prisma.purchase.findMany({ where: { buyerId: u.id }, select: { id: true, number: true, status: true, amount: true, createdAt: true, project: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.supportThread.count({ where: { userId: u.id } }),
      prisma.favorite.count({ where: { userId: u.id } }),
      prisma.activityEvent.groupBy({ by: ["type"], where: { userId: u.id }, _count: true }),
    ]);
    // daily heat-map (90 days) merging product events + audited actions
    const days = new Map<string, number>();
    for (let i = 89; i >= 0; i--) days.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0);
    for (const e of events) {
      const k = e.createdAt.toISOString().slice(0, 10);
      if (days.has(k)) days.set(k, days.get(k)! + 1);
    }
    for (const a of auditRows) {
      const k = a.createdAt.toISOString().slice(0, 10);
      if (days.has(k)) days.set(k, days.get(k)! + 1);
    }
    const projectIds = [...new Set(events.map((e) => e.projectId).filter(Boolean))] as string[];
    const projectNames = new Map((await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    const topProjects = Object.entries(
      events.reduce<Record<string, number>>((acc, e) => {
        if (e.projectId) acc[e.projectId] = (acc[e.projectId] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, name: projectNames.get(id) ?? id, count }));
    const lastSeen = [events[0]?.createdAt, u.lastLoginAt, auditRows[0]?.createdAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
    return {
      user: u,
      lastSeen,
      activeDays90: [...days.values()].filter((v) => v > 0).length,
      totals: {
        events: eventsByType.reduce((t, e) => t + e._count, 0),
        byType: Object.fromEntries(eventsByType.map((e) => [e.type, e._count])),
        purchases: purchases.length,
        supportThreads: threads,
        favorites,
      },
      daily: [...days.entries()].map(([date, count]) => ({ date, count })),
      topProjects,
      recent: [
        ...events.slice(0, 25).map((e) => ({ at: e.createdAt, kind: "event" as const, type: e.type, projectName: e.projectId ? (projectNames.get(e.projectId) ?? null) : null })),
        ...auditRows.slice(0, 25).map((a) => ({ at: a.createdAt, kind: "audit" as const, type: a.action, projectName: null, entity: a.entity, ip: a.ip })),
      ]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 30),
      sessions: sessions.map((s) => ({ ...s, active: !s.revokedAt && s.expiresAt > new Date() })),
      purchases: purchases.map((p) => ({ ...p, amount: p.amount.toFixed(2) })),
    };
  });

  // block with a reason (users) — complements PATCH /admin/users/:id
  app.post<{ Params: { id: string } }>("/admin/users/:id/block", async (req) => {
    const { user } = scopeOf(req, "admin");
    const body = z.object({ blocked: z.boolean(), reason: reason.optional() }).parse(req.body);
    if (req.params.id === user.id) throw badRequest("O'zingizni bloklay olmaysiz");
    if (body.blocked && !body.reason) throw badRequest("Bloklash sababini kiriting", "REASON_REQUIRED");
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound();
    if ((target.role === "SUPERADMIN" || target.role === "ADMIN") && user.role !== "SUPERADMIN") throw forbidden();
    const u = await prisma.user.update({ where: { id: target.id }, data: { status: body.blocked ? "BLOCKED" : "ACTIVE", blockReason: body.blocked ? body.reason : null }, select: { id: true, status: true, blockReason: true } });
    if (body.blocked) await prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
    void audit({ actorId: user.id, action: body.blocked ? "USER_BLOCK" : "USER_UNBLOCK", entity: "User", entityId: u.id, ip: req.ip, meta: { reason: body.reason } });
    return u;
  });
}
