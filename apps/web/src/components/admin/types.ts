// Admin-only DTOs (see docs/API.md → "Admin" and "Support chat")
import type { ProjectStatus, PurchaseKind, VerificationStatus } from "@eka/shared";
import type {
  AuditItem,
  CertificateItem,
  ControlFlags,
  ComplaintItem,
  DocumentItem,
  Org,
  ProjectCard,
  RuleItem,
  TrustBreakdownItem,
} from "@/lib/types";

export interface AdminStats {
  kpi: {
    users: number;
    organizations: number;
    projects: number;
    purchases: number;
    revenue: number | string;
    openComplaints: number;
    pendingOrgs: number;
    pendingProjects: number;
    pendingCertificates: number;
    pendingDocuments: number;
  };
  purchasesByMonth: { month: string; count: number; amount: number | string }[];
  projectsByStatus: { status: ProjectStatus; count: number }[];
  projectsByRegion: { region: string; count: number }[];
  trustDistribution: { bucket: string; count: number }[];
  recentAudit: AuditItem[];
}

export type OrgRow = Org & ControlFlags & { membersCount?: number; projectsCount?: number; rejectReason?: string | null; createdAt?: string };

export type ProjectRow = ProjectCard & ControlFlags & {
  published: boolean;
  featured: boolean;
  verificationStatus: VerificationStatus;
  createdAt: string;
};

export type CertRow = CertificateItem & { project: { slug: string; name: string } | null };
export type DocRow = DocumentItem & ControlFlags & { project: { slug: string; name: string } | null; rejectReason?: string | null };
export type ComplaintRow = ComplaintItem & ControlFlags;

export interface TemplateItem {
  id: string;
  key: string;
  name: string;
  kind: PurchaseKind;
  body: string;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type RuleRow = RuleItem & { order?: number; published?: boolean; createdAt?: string; updatedAt?: string };

export interface SupportStats {
  open: number;
  pending: number;
  closedToday: number;
  agentsOnline: number;
  avgFirstResponseMin: number | null;
}

export interface AuditVerifyResult {
  ok: boolean;
  checked: number;
  brokenAt: string | null;
}

export interface TrustResult {
  trustScore: number;
  trustBreakdown: TrustBreakdownItem[];
}

/** Optional sort carried in the URL as `sort=key:dir` */
export type SortState = { key: string; dir: "asc" | "desc" } | null;
