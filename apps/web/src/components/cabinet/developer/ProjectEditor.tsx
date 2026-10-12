"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { Icon as IconType } from "iconsax-reactjs";
import { Activity, Building, DocumentText, ExportSquare, Grid2, I3Dcube, Send2, Verify } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { asList } from "../hooks";
import { ErrorState } from "../states";
import { BackLink, ConfirmDialog } from "../ui";
import { useBreadcrumb } from "@/components/layout/Breadcrumbs";
import type { DevProject } from "./DevDashboardView";
import { BasicTab } from "./editor/BasicTab";
import { CertificatesTab } from "./editor/CertificatesTab";
import { DocumentsTab } from "./editor/DocumentsTab";
import { ModelTab } from "./editor/ModelTab";
import { ProgressTab } from "./editor/ProgressTab";
import { UnitsTab } from "./editor/UnitsTab";

type TabKey = "basic" | "units" | "documents" | "certificates" | "model" | "progress";
const TABS: { key: TabKey; icon: IconType }[] = [
  { key: "basic", icon: Building },
  { key: "units", icon: Grid2 },
  { key: "documents", icon: DocumentText },
  { key: "certificates", icon: Verify },
  { key: "model", icon: I3Dcube },
  { key: "progress", icon: Activity },
];

/** Create / edit a project. `id === null` → new project (only the "Asosiy" tab is enabled until saved). */
export function ProjectEditor({ id }: { id: string | null }) {
  const { t, tr } = useI18n();
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("basic");
  const [card, setCard] = React.useState<DevProject | null>(null);
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null);
  const [loading, setLoading] = React.useState(Boolean(id));
  const [error, setError] = React.useState<unknown>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const list = asList<DevProject>(await api.get<unknown>("/dev/projects"));
      const found = list.find((p) => p.id === id) ?? null;
      if (!found) {
        setError(new ApiError(404, "NOT_FOUND", "Project not found"));
        setCard(null);
        return;
      }
      setCard(found);
      try {
        const d = await api.get<ProjectDetail>(`/projects/${found.slug}`);
        setDetail(d);
      } catch {
        setDetail(null);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // read ?tab= once (deep links from other pages)
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p && TABS.some((x) => x.key === p)) setTab(p as TabKey);
  }, []);

  const submitForModeration = async () => {
    try {
      await api.post(`/dev/projects/${id}/submit`);
      toast.success(t("app.developer.editor.submit.success"));
      setSubmitOpen(false);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    }
  };

  const crumbName = detail?.name ?? card?.name;
  useBreadcrumb(id ? (crumbName ? tr(crumbName) : null) : t("app.developer.editor.newTitle"));

  if (id && loading) return <EditorSkeleton />;
  if (id && (error || !card)) {
    return (
      <div>
        <BackLink href="/app/developer/projects" label={t("app.developer.editor.back")} />
        <ErrorState error={error} onRetry={load} />
      </div>
    );
  }

  const name = detail?.name ?? card?.name;
  const status = detail?.status ?? card?.status;
  const verification = detail?.verificationStatus ?? card?.verificationStatus;
  const published = detail?.published ?? card?.published;
  const slug = detail?.slug ?? card?.slug;

  // the full detail is what the tabs edit; when only the card loaded, fall back to it
  const editable: ProjectDetail | null = detail ?? (card ? ({ ...card, documents: [], certificates: [], progressUpdates: [], massing: null } as unknown as ProjectDetail) : null);

  return (
    <div>
      <BackLink href="/app/developer/projects" label={t("app.developer.editor.back")} />

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          {id && card && <TrustRing score={detail?.trustScore ?? card.trustScore} size={64} stroke={5} className="hidden sm:inline-flex" />}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {status && <StatusBadge kind="projectStatus" value={status} />}
              {verification && <StatusBadge kind="verification" value={verification} />}
              {id && (published ? <Badge tone="success" dot>{t("app.developer.projects.published")}</Badge> : <Badge dot>{t("app.developer.projects.draft")}</Badge>)}
            </div>
            <h1 className="text-balance bg-gradient-to-br from-stone-100 from-40% to-gold-200 bg-clip-text pb-1 font-display text-[34px] font-medium leading-[1.05] text-transparent md:text-[44px]">
              {id && name ? tr(name) : t("app.developer.editor.newTitle")}
            </h1>
            {!id && <p className="mt-2 max-w-2xl text-sm text-ink-300">{t("app.developer.editor.newSubtitle")}</p>}
          </div>
        </div>
        {id && (
          <div className="flex flex-wrap gap-2">
            {slug && (
              <Button asChild variant="secondary">
                <Link href={`/projects/${slug}`} target="_blank">
                  {t("app.developer.editor.viewPublic")} <ExportSquare size={16} />
                </Link>
              </Button>
            )}
            <Button variant="gold" onClick={() => setSubmitOpen(true)} disabled={verification === "VERIFIED" && published}>
              <Send2 size={18} variant="Bold" /> {t("app.developer.editor.submit.button")}
            </Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="no-scrollbar w-full justify-start overflow-x-auto md:w-auto">
          {TABS.map(({ key, icon: Icon }) => {
            const disabled = !id && key !== "basic";
            const trigger = (
              <TabsTrigger key={key} value={key} disabled={disabled} className="disabled:cursor-not-allowed disabled:opacity-40">
                <Icon variant={tab === key ? "Bulk" : "Linear"} /> {t(`app.developer.editor.tabs.${key}`)}
              </TabsTrigger>
            );
            return disabled ? (
              <Tooltip key={key} content={t("app.developer.editor.saveFirst")}>
                <span>{trigger}</span>
              </Tooltip>
            ) : (
              trigger
            );
          })}
        </TabsList>

        {/* the basic form stays mounted so unsaved edits survive tab switches */}
        <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden">
          <Pane>
            <BasicTab
              projectId={id}
              detail={editable}
              onSaved={(p) => {
                if (!id && p.id) {
                  router.replace(`/app/developer/projects/${p.id}?tab=units`);
                  router.refresh();
                } else void load();
              }}
            />
          </Pane>
        </TabsContent>
        {id && (
          <>
            <TabsContent value="units">
              <Pane>
                <UnitsTab projectId={id} detail={editable} />
              </Pane>
            </TabsContent>
            <TabsContent value="documents">
              <Pane>
                <DocumentsTab projectId={id} detail={editable} onChanged={load} />
              </Pane>
            </TabsContent>
            <TabsContent value="certificates">
              <Pane>
                <CertificatesTab projectId={id} detail={editable} onChanged={load} />
              </Pane>
            </TabsContent>
            <TabsContent value="model">
              <Pane>
                <ModelTab projectId={id} detail={editable} onChanged={load} />
              </Pane>
            </TabsContent>
            <TabsContent value="progress">
              <Pane>
                <ProgressTab projectId={id} detail={editable} onChanged={load} />
              </Pane>
            </TabsContent>
          </>
        )}
      </Tabs>

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        icon={Send2}
        title={t("app.developer.editor.submit.confirmTitle")}
        description={t("app.developer.editor.submit.confirmText")}
        confirmLabel={t("app.developer.editor.submit.button")}
        onConfirm={submitForModeration}
      />
    </div>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-72" />
        </div>
      </div>
      <Skeleton className="h-11 w-full max-w-2xl rounded-xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
