"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProjectDetail, UnitItem } from "@/lib/types";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { PurchaseDialog, type PurchaseTarget } from "./PurchaseDialog";

export const TAB_KEYS = ["overview", "model", "drawings", "documents", "cadastre", "progress", "inspections", "units"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
const isTab = (v: string): v is TabKey => (TAB_KEYS as readonly string[]).includes(v);

type UnitsState = { status: "idle" | "loading" | "ready" | "error"; items: UnitItem[] };

type Ctx = {
  project: ProjectDetail;
  tab: TabKey;
  setTab: (t: TabKey, opts?: { scroll?: boolean }) => void;
  units: UnitsState;
  loadUnits: (force?: boolean) => void;
  loginHref: (hash?: string) => string;
  /** returns false (and redirects to /login?next=…) when the visitor is anonymous */
  requireAuth: (hash?: string) => boolean;
  buy: (target: PurchaseTarget) => void;
  packagePurchase: ProjectDetail["viewer"]["purchases"][number] | null;
  purchaseForUnit: (unitId: string) => ProjectDetail["viewer"]["purchases"][number] | undefined;
};

const ProjectContext = React.createContext<Ctx | null>(null);

export function useProject() {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}

const ACTIVE = new Set(["DRAFT", "PENDING_SIGNATURES", "SIGNED", "PAID", "COMPLETED"]);

export function ProjectProvider({ project, children }: { project: ProjectDetail; children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTabState] = React.useState<TabKey>("overview");
  const [units, setUnits] = React.useState<UnitsState>({ status: "idle", items: [] });
  const [target, setTarget] = React.useState<PurchaseTarget | null>(null);
  const viewer = project.viewer ?? { authenticated: false, isFavorite: false, hasAccess: false, isOwner: false, purchases: [] };

  // ── tabs ⇄ URL hash ──
  React.useEffect(() => {
    const read = (scroll: boolean) => {
      const h = window.location.hash.replace("#", "");
      if (!isTab(h)) return;
      setTabState(h);
      if (scroll) setTimeout(() => document.getElementById("project-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    };
    read(true);
    const onHash = () => read(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setTab = React.useCallback((next: TabKey, opts?: { scroll?: boolean }) => {
    setTabState(next);
    const url = `${window.location.pathname}${window.location.search}${next === "overview" ? "" : `#${next}`}`;
    window.history.replaceState(window.history.state, "", url);
    if (opts?.scroll) {
      requestAnimationFrame(() => document.getElementById("project-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);

  // ── units (lazy, cached) ──
  const unitsRef = React.useRef(units);
  unitsRef.current = units;
  const loadUnits = React.useCallback(
    (force?: boolean) => {
      const u = unitsRef.current;
      if (!force && (u.status === "loading" || u.status === "ready")) return;
      unitsRef.current = { ...u, status: "loading" };
      setUnits((p) => ({ ...p, status: "loading" }));
      api
        .get<UnitItem[] | { items: UnitItem[] }>(`/projects/${encodeURIComponent(project.slug)}/units`)
        .then((r) => setUnits({ status: "ready", items: Array.isArray(r) ? r : (r?.items ?? []) }))
        .catch(() => setUnits((p) => ({ status: "error", items: p.items })));
    },
    [project.slug],
  );

  // ── record a view once per session ──
  React.useEffect(() => {
    const key = `eka_viewed_${project.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    api.post(`/projects/${project.id}/view`).catch(() => {});
  }, [project.id]);

  const loginHref = React.useCallback(
    (hash?: string) => `/login?next=${encodeURIComponent(`/projects/${project.slug}${hash ? `#${hash}` : ""}`)}`,
    [project.slug],
  );
  const requireAuth = React.useCallback(
    (hash?: string) => {
      if (viewer.authenticated) return true;
      toast.info(t("catalog.auth.required"));
      router.push(loginHref(hash));
      return false;
    },
    [viewer.authenticated, router, loginHref, t],
  );

  const buy = React.useCallback(
    (tg: PurchaseTarget) => {
      if (!requireAuth(tg.kind === "UNIT" ? "units" : "drawings")) return;
      setTarget(tg);
    },
    [requireAuth],
  );

  const purchases = viewer.purchases ?? [];
  const packagePurchase = purchases.find((p) => p.kind === "DOCUMENT_PACKAGE" && ACTIVE.has(p.status)) ?? null;
  const purchaseForUnit = React.useCallback(
    (unitId: string) => purchases.find((p) => p.kind === "UNIT" && p.unitId === unitId && ACTIVE.has(p.status)),
    [purchases],
  );

  const value: Ctx = {
    project: { ...project, viewer },
    tab,
    setTab,
    units,
    loadUnits,
    loginHref,
    requireAuth,
    buy,
    packagePurchase,
    purchaseForUnit,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
      <PurchaseDialog
        project={project}
        target={target}
        onClose={() => setTarget(null)}
        onUnavailable={() => loadUnits(true)}
        loginHref={loginHref}
      />
    </ProjectContext.Provider>
  );
}
