import type { Icon as IconType } from "iconsax-reactjs";
import {
  Award,
  CalendarTick,
  MoneyRecive,
  Buildings2,
  Diagram,
  Graph,
  Building4,
  Category,
  ClipboardText,
  DocumentText,
  Flag,
  Judge,
  Messages2,
  People,
  Receipt2,
  ShieldSearch,
} from "iconsax-reactjs";
import type { MessageKey } from "@/i18n/core";
import type { AdminCounts } from "./context";

export type AdminNavKey =
  | "dashboard"
  | "analytics"
  | "systemMap"
  | "organizations"
  | "projects"
  | "certificates"
  | "documents"
  | "complaints"
  | "purchases"
  | "templates"
  | "support"
  | "rules"
  | "users"
  | "audit"
  | "finance"
  | "deadlines";

export type AdminNavEntry = {
  key: AdminNavKey;
  href: string;
  icon: IconType;
  exact?: boolean;
  badge?: keyof AdminCounts | "support";
  keywords?: string;
};

export const ADMIN_NAV: { title: MessageKey; items: AdminNavEntry[] }[] = [
  { title: "admin.nav.general", items: [{ key: "dashboard", href: "/admin", icon: Category, exact: true, keywords: "kpi stats statistika" }] },
  { title: "admin.nav.insights", items: [{ key: "analytics", href: "/admin/analytics", icon: Graph, keywords: "analytics funnel voronka hisobot report chart" }] },
  {
    title: "admin.nav.moderation",
    items: [
      { key: "organizations", href: "/admin/organizations", icon: Buildings2, badge: "pendingOrgs", keywords: "stir tin org" },
      { key: "projects", href: "/admin/projects", icon: Building4, badge: "pendingProjects", keywords: "project obyekt" },
      { key: "certificates", href: "/admin/certificates", icon: Award, badge: "pendingCertificates", keywords: "qr verify" },
      { key: "documents", href: "/admin/documents", icon: DocumentText, badge: "pendingDocuments", keywords: "pdf file" },
      { key: "complaints", href: "/admin/complaints", icon: Flag, badge: "openComplaints", keywords: "fraud" },
    ],
  },
  {
    title: "admin.nav.sales",
    items: [
      { key: "purchases", href: "/admin/purchases", icon: Receipt2, keywords: "purchase sale" },
      { key: "templates", href: "/admin/templates", icon: ClipboardText, keywords: "contract template" },
    ],
  },
  {
    title: "admin.nav.control",
    items: [
      { key: "finance", href: "/admin/finance", icon: MoneyRecive, keywords: "moliya finance payment to'lov tolov hisob-kitob excel debitor overdue финансы платежи" },
      { key: "deadlines", href: "/admin/deadlines", icon: CalendarTick, keywords: "muddat deadline sroki сроки bron reservation expiry" },
    ],
  },
  { title: "admin.nav.comms", items: [{ key: "support", href: "/admin/support", icon: Messages2, badge: "support", keywords: "chat inbox" }] },
  { title: "admin.nav.content", items: [{ key: "rules", href: "/admin/rules", icon: Judge, keywords: "shnq qmq" }] },
  {
    title: "admin.nav.system",
    items: [
      { key: "users", href: "/admin/users", icon: People, keywords: "user role" },
      { key: "audit", href: "/admin/audit", icon: ShieldSearch, keywords: "log hash chain" },
      { key: "systemMap", href: "/admin/system", icon: Diagram, keywords: "architecture arxitektura health nginx k8s flow sxema" },
    ],
  },
];

export const navLabelKey = (key: AdminNavKey) => `admin.nav.${key}` as MessageKey;
