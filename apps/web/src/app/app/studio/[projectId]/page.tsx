import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { serverApiSafe } from "@/lib/api-server";
import type { ProjectDetail } from "@/lib/types";
import { StudioProject } from "@/components/studio/StudioProject";

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const { t, tr } = await getI18n();
  let name: string | null = null;
  try {
    name = (await serverApiSafe<ProjectDetail>(`/projects/${encodeURIComponent(projectId)}`))?.name ?? null;
  } catch {
    name = null;
  }
  return { title: name ? t("studio.meta.project", { name: tr(name) }) : t("studio.meta.title"), description: t("studio.meta.description") };
}

/** /app/studio/<slug | id> — opens the project's 3D model in the studio. */
export default async function Page({ params }: Props) {
  const { projectId } = await params;
  return <StudioProject projectId={decodeURIComponent(projectId)} />;
}
