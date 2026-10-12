"use client";
// /app/studio/[projectId] — resolves a project (slug or id) and opens its 3D model in the studio.
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Warning2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useCabinetUser } from "@/components/cabinet/CabinetContext";
import { Studio, StudioSkeleton } from "./Studio";

type State = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; p: ProjectDetail };

export function StudioProject({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { user } = useCabinetUser();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    api
      .get<ProjectDetail>(`/projects/${encodeURIComponent(projectId)}`)
      .then((p) => alive && setState({ status: "ready", p }))
      .catch((e: unknown) => alive && setState({ status: "error", notFound: e instanceof ApiError && (e.status === 404 || e.status === 403) }));
    return () => {
      alive = false;
    };
  }, [projectId, attempt]);

  if (state.status === "loading") return <StudioSkeleton label={t("studio.project.loading")} />;
  if (state.status === "error")
    return (
      <EmptyState
        icon={Warning2}
        title={state.notFound ? t("studio.project.notFound") : t("studio.home.loadError")}
        description={state.notFound ? t("studio.project.notFoundHint") : undefined}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {!state.notFound && (
              <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                {t("studio.home.retry")}
              </Button>
            )}
            <Button asChild variant="gold">
              <Link href="/app/studio">
                <ArrowLeft size={16} /> {t("studio.project.back")}
              </Link>
            </Button>
          </div>
        }
      />
    );
  const p = state.p;
  const m = p.model3d;
  return (
    <Studio
      key={p.id + (m?.id ?? "")}
      source={m ? { kind: "url", url: m.url, name: m.originalName, size: m.size } : null}
      project={{ id: p.id, slug: p.slug, name: p.name, isOwner: Boolean(p.viewer?.isOwner) }}
      isDeveloper={user.role === "DEVELOPER"}
    />
  );
}
