// Shared enums, labels and helpers for EKA BUILD (api + web).
// Enum values mirror apps/api/prisma/schema.prisma.

export const ROLES = ["BUYER", "DEVELOPER", "INSPECTOR", "ADMIN", "SUPERADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ORG_TYPES = ["DEVELOPER", "BUYER_COMPANY", "INSPECTION_BODY"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PROJECT_STATUSES = [
  "PLANNING",
  "PERMITTED",
  "UNDER_CONSTRUCTION",
  "COMPLETED",
  "COMMISSIONED",
  "SUSPENDED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = ["RESIDENTIAL", "COMMERCIAL", "MIXED", "INDUSTRIAL"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const UNIT_TYPES = ["APARTMENT", "COMMERCIAL", "OFFICE", "PARKING", "STORAGE"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = ["AVAILABLE", "RESERVED", "SOLD"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const DOCUMENT_TYPES = [
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
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ACCESS_LEVELS = ["PUBLIC", "BUYERS", "PRIVATE"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const CERTIFICATE_TYPES = [
  "BUILDING_PERMIT",
  "CONSTRUCTION_LICENSE",
  "STATE_EXPERTISE",
  "CONFORMITY",
  "COMMISSIONING",
  "FIRE_SAFETY",
  "ENVIRONMENTAL",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_STATUSES = ["PENDING", "VERIFIED", "REJECTED", "EXPIRED", "REVOKED"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CADASTRE_RESULTS = ["MATCH", "PARTIAL", "MISMATCH", "NOT_FOUND", "ERROR"] as const;
export type CadastreResult = (typeof CADASTRE_RESULTS)[number];

export const INSPECTION_TYPES = ["SCHEDULED", "UNSCHEDULED", "FOUNDATION", "FRAME", "ENGINEERING", "FINAL"] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_RESULTS = ["PASSED", "ISSUES", "FAILED"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const PROGRESS_PHASES = ["CONSTRUCTION", "POST_HANDOVER"] as const;
export type ProgressPhase = (typeof PROGRESS_PHASES)[number];

export const PURCHASE_STATUSES = ["DRAFT", "PENDING_SIGNATURES", "SIGNED", "PAID", "COMPLETED", "CANCELLED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_KINDS = ["UNIT", "DOCUMENT_PACKAGE"] as const;
export type PurchaseKind = (typeof PURCHASE_KINDS)[number];

export const CONTRACT_STATUSES = ["DRAFT", "PENDING", "PARTIALLY_SIGNED", "SIGNED", "CANCELLED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const SIGNER_ROLES = ["BUYER", "SELLER", "WITNESS"] as const;
export type SignerRole = (typeof SIGNER_ROLES)[number];

export const COMPLAINT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_CATEGORIES = ["FRAUD", "FAKE_DOCUMENT", "DELAY", "QUALITY", "DOUBLE_SALE", "OTHER"] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon",
  "Buxoro",
  "Farg'ona",
  "Jizzax",
  "Xorazm",
  "Namangan",
  "Navoiy",
  "Qashqadaryo",
  "Qoraqalpog'iston",
  "Samarqand",
  "Sirdaryo",
  "Surxondaryo",
] as const;

// ───────────────────────────── Uzbek labels ─────────────────────────────

export const LABELS = {
  role: {
    BUYER: "Xaridor",
    DEVELOPER: "Quruvchi",
    INSPECTOR: "Nazoratchi",
    ADMIN: "Administrator",
    SUPERADMIN: "Bosh administrator",
  } satisfies Record<Role, string>,
  orgType: {
    DEVELOPER: "Quruvchi kompaniya",
    BUYER_COMPANY: "Xaridor yuridik shaxs",
    INSPECTION_BODY: "Nazorat organi",
  } satisfies Record<OrgType, string>,
  verification: {
    PENDING: "Tekshiruvda",
    VERIFIED: "Tasdiqlangan",
    REJECTED: "Rad etilgan",
  } satisfies Record<VerificationStatus, string>,
  projectStatus: {
    PLANNING: "Loyihalashda",
    PERMITTED: "Ruxsat olingan",
    UNDER_CONSTRUCTION: "Qurilmoqda",
    COMPLETED: "Qurib bitkazilgan",
    COMMISSIONED: "Foydalanishga topshirilgan",
    SUSPENDED: "To'xtatilgan",
  } satisfies Record<ProjectStatus, string>,
  projectType: {
    RESIDENTIAL: "Turar-joy",
    COMMERCIAL: "Tijorat",
    MIXED: "Aralash",
    INDUSTRIAL: "Sanoat",
  } satisfies Record<ProjectType, string>,
  unitType: {
    APARTMENT: "Xonadon",
    COMMERCIAL: "Tijorat joyi",
    OFFICE: "Ofis",
    PARKING: "Avtoturargoh",
    STORAGE: "Omborxona",
  } satisfies Record<UnitType, string>,
  unitStatus: {
    AVAILABLE: "Sotuvda",
    RESERVED: "Band qilingan",
    SOLD: "Sotilgan",
  } satisfies Record<UnitStatus, string>,
  documentType: {
    BUILDING_PERMIT: "Qurilish ruxsatnomasi",
    LICENSE: "Litsenziya",
    EXPERTISE: "Davlat ekspertizasi xulosasi",
    CADASTRE_EXTRACT: "Kadastr ko'chirmasi",
    LAND_ALLOTMENT: "Yer ajratish qarori",
    CONFORMITY_CERT: "Muvofiqlik sertifikati",
    COMMISSIONING_ACT: "Foydalanishga qabul dalolatnomasi",
    DRAWING: "Chizma",
    MODEL_3D: "3D model",
    FLOOR_PLAN: "Qavat rejasi",
    REGULATION: "Qoida / reglament",
    CONTRACT: "Shartnoma",
    PHOTO: "Fotosurat",
    OTHER: "Boshqa",
  } satisfies Record<DocumentType, string>,
  access: {
    PUBLIC: "Ochiq",
    BUYERS: "Xaridorlar uchun",
    PRIVATE: "Yopiq",
  } satisfies Record<AccessLevel, string>,
  certificateType: {
    BUILDING_PERMIT: "Qurilish ruxsatnomasi",
    CONSTRUCTION_LICENSE: "Qurilish litsenziyasi",
    STATE_EXPERTISE: "Davlat ekspertizasi",
    CONFORMITY: "Muvofiqlik sertifikati",
    COMMISSIONING: "Foydalanishga topshirish",
    FIRE_SAFETY: "Yong'in xavfsizligi",
    ENVIRONMENTAL: "Ekologik ekspertiza",
  } satisfies Record<CertificateType, string>,
  certificateStatus: {
    PENDING: "Tekshiruvda",
    VERIFIED: "Haqiqiy",
    REJECTED: "Rad etilgan",
    EXPIRED: "Muddati o'tgan",
    REVOKED: "Bekor qilingan",
  } satisfies Record<CertificateStatus, string>,
  cadastreResult: {
    MATCH: "To'liq mos",
    PARTIAL: "Qisman mos",
    MISMATCH: "Mos emas",
    NOT_FOUND: "Topilmadi",
    ERROR: "Xatolik",
  } satisfies Record<CadastreResult, string>,
  inspectionType: {
    SCHEDULED: "Rejali",
    UNSCHEDULED: "Rejadan tashqari",
    FOUNDATION: "Poydevor",
    FRAME: "Karkas",
    ENGINEERING: "Muhandislik tarmoqlari",
    FINAL: "Yakuniy",
  } satisfies Record<InspectionType, string>,
  inspectionResult: {
    PASSED: "Muvofiq",
    ISSUES: "Kamchiliklar bor",
    FAILED: "Nomuvofiq",
  } satisfies Record<InspectionResult, string>,
  progressPhase: {
    CONSTRUCTION: "Qurilish",
    POST_HANDOVER: "Topshirilgandan keyin",
  } satisfies Record<ProgressPhase, string>,
  purchaseStatus: {
    DRAFT: "Qoralama",
    PENDING_SIGNATURES: "Imzo kutilmoqda",
    SIGNED: "Imzolangan",
    PAID: "To'langan",
    COMPLETED: "Yakunlangan",
    CANCELLED: "Bekor qilingan",
  } satisfies Record<PurchaseStatus, string>,
  purchaseKind: {
    UNIT: "Xonadon / joy",
    DOCUMENT_PACKAGE: "Hujjatlar paketi",
  } satisfies Record<PurchaseKind, string>,
  contractStatus: {
    DRAFT: "Qoralama",
    PENDING: "Imzo kutilmoqda",
    PARTIALLY_SIGNED: "Qisman imzolangan",
    SIGNED: "Imzolangan",
    CANCELLED: "Bekor qilingan",
  } satisfies Record<ContractStatus, string>,
  signerRole: {
    BUYER: "Xaridor",
    SELLER: "Sotuvchi",
    WITNESS: "Guvoh",
  } satisfies Record<SignerRole, string>,
  complaintStatus: {
    OPEN: "Ochiq",
    IN_REVIEW: "Ko'rib chiqilmoqda",
    RESOLVED: "Hal qilindi",
    DISMISSED: "Rad etildi",
  } satisfies Record<ComplaintStatus, string>,
  complaintCategory: {
    FRAUD: "Firibgarlik",
    FAKE_DOCUMENT: "Soxta hujjat",
    DELAY: "Muddat buzilishi",
    QUALITY: "Sifat muammosi",
    DOUBLE_SALE: "Ikki marta sotish",
    OTHER: "Boshqa",
  } satisfies Record<ComplaintCategory, string>,
} as const;

// ───────────────────────────── Helpers ─────────────────────────────

export function formatMoney(value: number | string | null | undefined, currency = "UZS"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(n).replace(/,/g, " ");
  return currency === "UZS" ? `${formatted} so'm` : `${formatted} ${currency}`;
}

export function formatCompactMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} trln`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} mlrd`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} mln`;
  return new Intl.NumberFormat("uz-UZ").format(n);
}

export function formatArea(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(value)} m²`;
}

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mm}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function trustLevel(score: number): { label: string; tone: "danger" | "warning" | "info" | "success" } {
  if (score >= 85) return { label: "Yuqori ishonch", tone: "success" };
  if (score >= 65) return { label: "Yaxshi", tone: "info" };
  if (score >= 40) return { label: "O'rtacha", tone: "warning" };
  return { label: "Past ishonch", tone: "danger" };
}

/** Uzbek legal-entity TIN (STIR) is 9 digits; individuals' PINFL is 14 digits. */
export const isTin = (v: string) => /^\d{9}$/.test(v);
export const isPinfl = (v: string) => /^\d{14}$/.test(v);

// ───────────────────────────── API DTOs (subset used by web) ─────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrustBreakdownItem {
  key: string;
  label: string;
  score: number;
  max: number;
  note?: string;
}

export interface MassingParams {
  /** Number of floors above ground */
  floors: number;
  /** Building footprint width/depth in metres */
  width: number;
  depth: number;
  /** Optional additional towers / sections */
  towers?: { x: number; z: number; floors: number; width: number; depth: number }[];
  /** Accent colour for glazing */
  accent?: string;
}
