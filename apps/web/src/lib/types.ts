// DTOs returned by the API — see docs/API.md
import type {
  AccessLevel,
  CadastreResult,
  CertificateStatus,
  CertificateType,
  ComplaintStatus,
  ContractStatus,
  DocumentType,
  InspectionResult,
  InspectionType,
  MassingParams,
  OrgType,
  ProgressPhase,
  ProjectStatus,
  ProjectType,
  PurchaseKind,
  PurchaseStatus,
  Role,
  SignerRole,
  TrustBreakdownItem,
  UnitStatus,
  UnitType,
  VerificationStatus,
} from "@eka/shared";

export type { Paginated, MassingParams, TrustBreakdownItem } from "@eka/shared";

export interface Org {
  id: string;
  type: OrgType;
  name: string;
  legalName: string | null;
  tin: string;
  director: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  region: string | null;
  licenseNumber: string | null;
  logoUrl: string | null;
  description: string | null;
  foundedYear: number | null;
  status: VerificationStatus;
  verifiedAt: string | null;
}

export interface User {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  pinfl: string | null;
  role: Role;
  status: "ACTIVE" | "BLOCKED";
  locale: string;
  avatarUrl: string | null;
  phoneVerifiedAt: string | null;
  organization: Org | null;
  createdAt: string;
}

export interface FileRef {
  id: string;
  url: string;
  originalName: string;
  mime: string;
  size: number;
  sha256: string;
}

export interface ProjectCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  type: ProjectType;
  status: ProjectStatus;
  region: string;
  district: string | null;
  address: string;
  lat: number;
  lng: number;
  coverUrl: string | null;
  floors: number;
  progress: number;
  priceFrom: string | null;
  pricePerSqm: string | null;
  currency: string;
  trustScore: number;
  verificationStatus: VerificationStatus;
  plannedEndDate: string | null;
  unitsTotal: number;
  unitsAvailable: number;
  developer: { id: string; name: string; logoUrl: string | null; status: VerificationStatus };
  // present in /dev and /admin listings
  published?: boolean;
  featured?: boolean;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  type: DocumentType;
  title: string;
  description: string | null;
  number: string | null;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  access: AccessLevel;
  status: VerificationStatus;
  verifiedAt: string | null;
  version: number;
  createdAt: string;
  locked: boolean;
  /** always present, even when locked — lets anyone prove a file is the registered original */
  sha256: string;
  rejectReason?: string | null;
  file: FileRef | null;
}

export interface CertificateItem {
  id: string;
  code: string;
  type: CertificateType;
  number: string;
  issuer: string;
  issuedAt: string;
  validUntil: string | null;
  status: CertificateStatus;
  verifiedAt: string | null;
  note: string | null;
  documentId: string | null;
}

export interface CadastreCheckItem {
  id: string;
  cadastreNumber: string;
  provider: string;
  result: CadastreResult;
  distanceM: number | null;
  details: {
    registryAddress?: string;
    registryArea?: number;
    registryLat?: number;
    registryLng?: number;
    owner?: string;
    purpose?: string;
    messages: string[];
  };
  createdAt: string;
}

export interface InspectionItem {
  id: string;
  type: InspectionType;
  result: InspectionResult;
  date: string;
  summary: string;
  notes: string | null;
  violations: { code: string; text: string; severity: "LOW" | "MEDIUM" | "HIGH"; resolved: boolean }[];
  inspector: { id: string; fullName: string; organization: string | null };
  files: FileRef[];
}

export interface ProgressItem {
  id: string;
  phase: ProgressPhase;
  title: string;
  body: string | null;
  stage: string | null;
  percent: number | null;
  date: string;
  author: { fullName: string } | null;
  media: FileRef[];
}

export interface UnitItem {
  id: string;
  number: string;
  section: number;
  floor: number;
  type: UnitType;
  rooms: number;
  area: number;
  price: string;
  status: UnitStatus;
  planUrl: string | null;
  features: Record<string, unknown> | null;
}

export interface ProjectDetail extends Omit<ProjectCard, "developer"> {
  description: string | null;
  cadastreNumber: string | null;
  landArea: number | null;
  totalArea: number | null;
  sections: number;
  startDate: string | null;
  actualEndDate: string | null;
  gallery: string[];
  massing: MassingParams | null;
  model3d: FileRef | null;
  packagePrice: string | null;
  trustBreakdown: TrustBreakdownItem[];
  views: number;
  published: boolean;
  developer: Org & { projectsCount: number };
  certificates: CertificateItem[];
  documents: DocumentItem[];
  cadastre: CadastreCheckItem | null;
  inspections: InspectionItem[];
  progressUpdates: ProgressItem[];
  unitsSummary: Record<UnitStatus, number>;
  viewer: {
    authenticated: boolean;
    isFavorite: boolean;
    hasAccess: boolean;
    isOwner: boolean;
    purchases: { id: string; number: string; kind: PurchaseKind; status: PurchaseStatus; unitId: string | null }[];
  };
}

export interface PurchaseItem {
  id: string;
  number: string;
  kind: PurchaseKind;
  status: PurchaseStatus;
  amount: string;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  project: { id: string; slug: string; name: string; coverUrl: string | null; address: string };
  unit: UnitItem | null;
  buyer: { id: string; fullName: string; phone: string };
  buyerOrg: { id: string; name: string; tin: string } | null;
  planType: "FULL" | "INSTALLMENT";
  downPercent: number;
  months: number;
  reservationUntil: string | null;
  contract: {
    id: string;
    number: string;
    status: ContractStatus;
    signedAt: string | null;
    /** roles that already signed */
    signedRoles: SignerRole[];
    /** which side of the deal the current viewer is on */
    viewerRole: SignerRole | null;
    canSign: boolean;
  } | null;
}

export interface SignatureItem {
  id: string;
  role: SignerRole;
  method: "EIMZO" | "MOCK";
  signerName: string | null;
  signerTin: string | null;
  signerPinfl: string | null;
  certSerial: string | null;
  certValidTo: string | null;
  verified: boolean;
  signedAt: string;
}

export interface ContractDetail {
  id: string;
  number: string;
  title: string;
  body: string;
  bodyHash: string;
  status: ContractStatus;
  signedAt: string | null;
  createdAt: string;
  purchase: PurchaseItem;
  signatures: SignatureItem[];
  viewerRole: SignerRole | null;
  canSign: boolean;
}

export interface RuleItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  code: string | null;
  summary: string | null;
  sourceUrl: string | null;
  body?: string;
}

export interface NotificationItem {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ComplaintItem {
  id: string;
  category: string;
  message: string;
  contact: string | null;
  status: ComplaintStatus;
  resolution: string | null;
  createdAt: string;
  project: { slug: string; name: string } | null;
  reporter: { fullName: string; phone: string } | null;
}

export interface AuditItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  hash: string;
  prevHash: string;
  createdAt: string;
  actor: { fullName: string; phone: string } | null;
}

export interface PublicStats {
  projects: number;
  developers: number;
  verifiedCertificates: number;
  inspections: number;
  unitsSold: number;
  avgTrust: number;
  regions: number;
}

// ── Support chat ──
export type SupportThreadStatus = "OPEN" | "PENDING" | "CLOSED";

export interface SupportThread {
  id: string;
  subject: string | null;
  status: SupportThreadStatus;
  guestName: string | null;
  guestPhone: string | null;
  user: { id: string; fullName: string; phone: string } | null;
  assignedTo: { id: string; fullName: string } | null;
  lastMessage: { body: string; senderType: "USER" | "AGENT" | "SYSTEM"; createdAt: string } | null;
  unreadForAgent: number;
  unreadForUser: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  senderType: "USER" | "AGENT" | "SYSTEM";
  sender: { id: string; fullName: string } | null;
  body: string;
  createdAt: string;
}

// ── Finance & control centre (docs/API.md → "Control centre") ──
export type PaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentPlanType = "FULL" | "INSTALLMENT";
export type PaymentMethod = "bank" | "cash" | "click" | "payme" | "uzum" | "demo";

/** One row of a deal's payment schedule (seq 0 = down payment / full payment). */
export interface PaymentItem {
  id: string;
  seq: number;
  dueDate: string;
  amount: string;
  status: PaymentStatus;
  paidAt: string | null;
  method: PaymentMethod | string | null;
  reference: string | null;
}

/** A payment in admin / developer lists, with the deal it belongs to. */
export interface DuePayment extends Omit<PaymentItem, "paidAt" | "method" | "reference"> {
  paidAt?: string | null;
  method?: string | null;
  reference?: string | null;
  daysLeft: number;
  purchase: {
    id: string;
    number: string;
    planType?: PaymentPlanType;
    projectId?: string;
    projectName: string;
    buyerName: string;
    buyerPhone: string;
  };
}

export interface FinanceSummary {
  totals: {
    deals: number;
    contracted: number;
    collected: number;
    receivable: number;
    overdue: number;
    overdueCount: number;
    pendingCount: number;
    /** 0–100 */
    collectionRate: number;
  };
  byPlan: { planType: PaymentPlanType; count: number; amount: number }[];
  /** past `months` + 6 months ahead */
  monthly: { month: string; collected: number; scheduled: number; overdue: number }[];
  byProject: { id: string; name: string; contracted: number; collected: number; overdue: number }[];
  upcoming: DuePayment[];
  overdue: DuePayment[];
}

export interface PaymentsPage {
  items: DuePayment[];
  total: number;
  page: number;
  pageSize: number;
  /** sum of `amount` over every row matching the filters */
  sum: string;
}

/** GET /purchases/:id/payments */
export interface PurchasePayments {
  planType: PaymentPlanType;
  downPercent: number;
  months: number;
  total: string;
  paid: string;
  balance: string;
  /** 0–100 */
  progress: number;
  next: Pick<PaymentItem, "id" | "seq" | "dueDate" | "amount" | "status"> | null;
  overdue: number;
  items: PaymentItem[];
}

/** GET /calc/installment */
export interface InstallmentCalc {
  total: number;
  interest: number;
  down: number;
  monthly: number;
  count: number;
  limits: { minDown: number; maxMonths: number; monthsOptions: number[] };
  schedule: { seq: number; dueDate: string; amount: number; principal: number; interest: number; balanceAfter: number }[];
}

export interface AnnexItem {
  key: string;
  name: string;
  version: number;
}

export type DeadlineKind = "certificate" | "project" | "reservation" | "payment" | "contract" | "complaint" | "document";
export type DeadlineSeverity = "overdue" | "critical" | "soon";

export interface Deadline {
  id: string;
  kind: DeadlineKind;
  severity: DeadlineSeverity;
  dueDate: string;
  daysLeft: number;
  title: string;
  subtitle: string;
  link: string;
}

export interface DeadlinesResponse {
  items: Deadline[];
  summary: Partial<Record<DeadlineSeverity | DeadlineKind, number>>;
}

/** GET /admin/users/:id/activity */
export interface UserActivity {
  user: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    role: Role;
    status: "ACTIVE" | "BLOCKED";
    blockReason: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    phoneVerifiedAt: string | null;
    organization: { id: string; name: string; type: OrgType } | null;
  };
  lastSeen: string | null;
  activeDays90: number;
  totals: { events: number; byType: Record<string, number>; purchases: number; supportThreads: number; favorites: number };
  daily: { date: string; count: number }[];
  topProjects: { id: string; name: string; count: number }[];
  recent: { at: string; kind: "event" | "audit"; type: string; projectName: string | null; entity?: string; ip?: string | null }[];
  sessions: { id: string; ip: string | null; userAgent: string | null; createdAt: string; expiresAt: string; revokedAt: string | null; active: boolean }[];
  purchases: { id: string; number: string; status: PurchaseStatus; amount: string; createdAt: string; project: { name: string } }[];
}

/** Moderation flags carried by admin list rows (organizations, projects, documents, complaints, users). */
export interface ControlFlags {
  archivedAt?: string | null;
  blockedAt?: string | null;
  blockReason?: string | null;
}
