import type { Metadata } from "next";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getI18n();
  return { title: id === "new" ? t("admin.templates.editor.newTitle") : t("admin.templates.editor.editTitle") };
}

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditor key={id} id={id} />;
}
