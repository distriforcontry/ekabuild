import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { StudioHome } from "@/components/studio/StudioHome";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("studio.meta.title"), description: t("studio.meta.description") };
}

/** /app/studio — gallery + local files; `?url=/api/v1/files/<id>&name=x.glb` opens a model directly. */
export default async function Page({ searchParams }: { searchParams: Promise<{ url?: string | string[]; name?: string | string[] }> }) {
  const sp = await searchParams;
  const url = typeof sp.url === "string" && /^(\/(?!\/)|https?:\/\/)/i.test(sp.url) ? sp.url : undefined;
  const name = typeof sp.name === "string" ? sp.name.slice(0, 120) : undefined;
  return <StudioHome initialUrl={url} initialName={name} />;
}
