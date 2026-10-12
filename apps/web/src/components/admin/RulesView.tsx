"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Add, Edit2, ExportSquare, Judge, Link21, Trash } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { RuleItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { siteOrigin, slugify } from "./format";
import { MarkdownEditor } from "./MarkdownEditor";
import { Dim, ErrorNotice, FilterSelect, OptimisticSwitch, RowActions, Switch, useConfirm } from "./primitives";
import type { RuleRow } from "./types";

async function loadRules(): Promise<RuleRow[]> {
  const unwrap = (d: unknown) => (Array.isArray(d) ? d : ((d as { items?: RuleRow[] })?.items ?? [])) as RuleRow[];
  try {
    return unwrap(await api.get("/admin/rules", { query: { pageSize: 500 } }));
  } catch (e) {
    // older API builds expose only the public list
    if (e instanceof ApiError && [404, 405].includes(e.status)) return unwrap(await api.get("/rules"));
    throw e;
  }
}

export function RulesView() {
  const { t, tr } = useI18n();
  const sp = useSearchParams();
  const [rows, setRows] = React.useState<RuleRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<RuleRow | "new" | null>(null);
  const [confirm, confirmNode] = useConfirm();

  const reload = React.useCallback(() => {
    setLoading(true);
    setError(null);
    loadRules()
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(reload, [reload]);

  React.useEffect(() => {
    if (sp.get("new") === "1") {
      setEditing("new");
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, [sp]);

  const categories = React.useMemo(() => [...new Set((rows ?? []).map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const data = React.useMemo(() => (rows ?? []).filter((r) => !category || r.category === category), [rows, category]);

  const patchRow = (id: string, patch: Partial<RuleRow>) => setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (r: RuleRow) =>
    confirm({
      title: t("admin.rules.deleteTitle"),
      description: (
        <>
          {t("admin.rules.deleteDesc", { title: tr(r.title) })} {t("admin.common.irreversible")}
        </>
      ),
      tone: "danger",
      icon: Trash,
      confirmLabel: t("common.actions.delete"),
      onConfirm: async () => {
        await api.del(`/admin/rules/${r.id}`);
        setRows((rs) => (rs ?? []).filter((x) => x.id !== r.id));
        toast.success(t("admin.rules.deleted"));
      },
    });

  const columns: Column<RuleRow>[] = [
    {
      key: "title",
      header: t("admin.rules.columns.title"),
      alwaysVisible: true,
      sortValue: (r) => r.title,
      exportValue: (r) => r.title,
      cell: (r) => (
        <div className="min-w-64 max-w-lg">
          <div className="line-clamp-1 font-semibold text-stone-100">{tr(r.title)}</div>
          <div className="line-clamp-1 text-xs text-ink-400">{r.summary ? tr(r.summary) : <span className="font-mono">/{r.slug}</span>}</div>
        </div>
      ),
    },
    { key: "category", header: t("admin.rules.columns.category"), sortValue: (r) => r.category, exportValue: (r) => r.category, cell: (r) => <Badge tone="neutral">{tr(r.category)}</Badge> },
    { key: "code", header: t("admin.rules.columns.code"), hideOnMobile: true, sortValue: (r) => r.code, exportValue: (r) => r.code, cell: (r) => <span className="whitespace-nowrap font-mono text-xs text-gold-200">{r.code ?? "—"}</span> },
    { key: "order", header: t("admin.rules.columns.order"), align: "center", hideOnMobile: true, sortValue: (r) => r.order ?? 0, exportValue: (r) => r.order, cell: (r) => <span className="font-mono text-xs text-ink-300">{r.order ?? 0}</span> },
    {
      key: "published",
      header: t("admin.rules.columns.published"),
      align: "center",
      sortValue: (r) => (r.published === false ? 0 : 1),
      exportValue: (r) => (r.published === false ? 0 : 1),
      cell: (r) => (
        <OptimisticSwitch
          checked={r.published !== false}
          aria-label={t("admin.rules.columns.published")}
          onChange={async (v) => {
            await api.patch(`/admin/rules/${r.id}`, { published: v });
            patchRow(r.id, { published: v });
          }}
          successText={(v) => (v ? t("admin.rules.publishedOn") : t("admin.rules.publishedOff"))}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (r) => (
        <RowActions
          actions={[
            { label: t("common.actions.edit"), icon: Edit2, onSelect: () => setEditing(r) },
            { label: t("admin.rules.view"), icon: ExportSquare, onSelect: () => window.open(`${siteOrigin()}/rules/${r.slug}`, "_blank", "noopener") },
            { label: t("common.actions.delete"), icon: Trash, tone: "danger", onSelect: () => remove(r), separatorBefore: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.content")}
        title={t("admin.rules.title")}
        description={t("admin.rules.description")}
        actions={
          <Button variant="gold" onClick={() => setEditing("new")}>
            <Add /> {t("admin.rules.new")}
          </Button>
        }
      />
      <ErrorNotice error={error} onRetry={reload} />
      <Dim active={loading && rows != null}>
        <DataTable
          columns={columns}
          data={data}
          rowKey={(r) => r.id}
          loading={loading && rows == null}
          searchText={(r) => `${r.title} ${r.code ?? ""} ${r.summary ?? ""} ${r.slug}`}
          onRowClick={(r) => setEditing(r)}
          pageSize={20}
          exportName="rules"
          emptyTitle={t("admin.rules.empty")}
          initialSort={{ key: "order", dir: "asc" }}
          toolbar={
            categories.length > 0 && (
              <FilterSelect value={category} onChange={setCategory} placeholder={t("admin.rules.columns.category")} options={categories.map((c) => ({ value: c, label: tr(c) }))} />
            )
          }
        />
      </Dim>

      <RuleDialog
        rule={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={(saved, isNew) => {
          setRows((rs) => (isNew ? [saved, ...(rs ?? [])] : (rs ?? []).map((r) => (r.id === saved.id ? { ...r, ...saved } : r))));
        }}
      />
      {confirmNode}
    </div>
  );
}

type RuleForm = { title: string; slug: string; category: string; code: string; summary: string; sourceUrl: string; order: string; published: boolean; body: string };
const EMPTY: RuleForm = { title: "", slug: "", category: "", code: "", summary: "", sourceUrl: "", order: "0", published: true, body: "" };

function RuleDialog({
  rule,
  categories,
  onClose,
  onSaved,
}: {
  rule: RuleRow | "new" | null;
  categories: string[];
  onClose: () => void;
  onSaved: (r: RuleRow, isNew: boolean) => void;
}) {
  const { t, tr } = useI18n();
  const isNew = rule === "new";
  const [form, setForm] = React.useState<RuleForm>(EMPTY);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [loadingBody, setLoadingBody] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setTouched(false);
    if (!rule) return;
    if (rule === "new") {
      setForm(EMPTY);
      setSlugTouched(false);
      return;
    }
    setSlugTouched(true);
    setForm({
      title: rule.title,
      slug: rule.slug,
      category: rule.category,
      code: rule.code ?? "",
      summary: rule.summary ?? "",
      sourceUrl: rule.sourceUrl ?? "",
      order: String(rule.order ?? 0),
      published: rule.published !== false,
      body: rule.body ?? "",
    });
    if (rule.body == null) {
      let alive = true;
      setLoadingBody(true);
      api
        .get<RuleItem | { rule: RuleItem }>(`/rules/${rule.slug}`)
        .then((r) => {
          const full = r && "rule" in r ? r.rule : (r as RuleItem);
          if (alive) setForm((f) => ({ ...f, body: full?.body ?? "" }));
        })
        .catch((e) => alive && toast.error(errorMessage(e)))
        .finally(() => alive && setLoadingBody(false));
      return () => {
        alive = false;
      };
    }
  }, [rule]);

  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const errors = { title: !form.title.trim(), category: !form.category.trim(), body: !form.body.trim(), slug: !/^[a-z0-9-]+$/.test(form.slug) };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) {
      toast.error(t("admin.rules.form.required"));
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug,
      category: form.category.trim(),
      code: form.code.trim() || null,
      summary: form.summary.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
      order: Number(form.order) || 0,
      published: form.published,
      body: form.body,
    };
    try {
      if (isNew) {
        const res = await api.post<RuleRow | { rule: RuleRow }>("/admin/rules", payload);
        const created = res && "rule" in res ? res.rule : (res as RuleRow);
        onSaved({ ...payload, ...(created ?? {}), id: created?.id ?? crypto.randomUUID() } as RuleRow, true);
        toast.success(t("admin.rules.created"));
      } else if (rule) {
        await api.patch(`/admin/rules/${rule.id}`, payload);
        onSaved({ ...rule, ...payload }, false);
        toast.success(t("admin.rules.saved"));
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(rule)} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent size="full" className="flex max-w-6xl flex-col">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
              <Judge size={22} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{isNew ? t("admin.rules.form.newTitle") : t("admin.rules.form.editTitle")}</DialogTitle>
              <DialogDescription className="truncate">{rule && rule !== "new" ? tr(rule.title) : t("admin.rules.description")}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label={t("admin.rules.form.title")} htmlFor="rule-title" className="md:col-span-2" error={touched && errors.title ? t("common.errors.required") : undefined}>
                <Input
                  id="rule-title"
                  value={form.title}
                  autoFocus
                  aria-invalid={touched && errors.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                  }}
                />
              </Field>
              <Field label={t("admin.rules.form.slug")} htmlFor="rule-slug" hint={t("admin.rules.form.slugHint")} className="md:col-span-2" error={touched && errors.slug ? t("common.errors.required") : undefined}>
                <div className="relative">
                  <Link21 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <Input
                    id="rule-slug"
                    value={form.slug}
                    className="pl-10 font-mono text-[13px]"
                    aria-invalid={touched && errors.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value) + (e.target.value.endsWith("-") ? "-" : ""));
                    }}
                  />
                </div>
              </Field>
              <Field label={t("admin.rules.form.category")} htmlFor="rule-cat" className="md:col-span-2" error={touched && errors.category ? t("common.errors.required") : undefined}>
                <Input id="rule-cat" list="rule-categories" value={form.category} placeholder={t("admin.rules.form.categoryPlaceholder")} aria-invalid={touched && errors.category} onChange={(e) => set("category", e.target.value)} />
                <datalist id="rule-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.slice(0, 8).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("category", c)}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] transition",
                          form.category === c ? "border-gold-500/50 bg-gold-500/10 text-gold-200" : "border-line text-ink-300 hover:border-line-strong hover:text-stone-100",
                        )}
                      >
                        {tr(c)}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label={t("admin.rules.form.code")} htmlFor="rule-code">
                <Input id="rule-code" value={form.code} className="font-mono" placeholder={t("admin.rules.form.codePlaceholder")} onChange={(e) => set("code", e.target.value)} />
              </Field>
              <Field label={t("admin.rules.form.order")} htmlFor="rule-order">
                <Input id="rule-order" type="number" inputMode="numeric" value={form.order} className="font-mono" onChange={(e) => set("order", e.target.value)} />
              </Field>
              <Field label={t("admin.rules.form.summary")} htmlFor="rule-summary" className="md:col-span-2">
                <Textarea id="rule-summary" value={form.summary} maxLength={512} className="min-h-20" onChange={(e) => set("summary", e.target.value)} />
              </Field>
              <div className="flex flex-col gap-4 md:col-span-2">
                <Field label={t("admin.rules.form.sourceUrl")} htmlFor="rule-src">
                  <Input id="rule-src" type="url" value={form.sourceUrl} placeholder="https://lex.uz/…" onChange={(e) => set("sourceUrl", e.target.value)} />
                </Field>
                <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-ink-850 px-3.5">
                  <Switch checked={form.published} onCheckedChange={(v) => set("published", v)} aria-label={t("admin.rules.form.published")} />
                  <span className="text-sm text-stone-100">{t("admin.rules.form.published")}</span>
                </label>
              </div>
            </div>

            <div className="mt-5">
              {loadingBody ? (
                <Skeleton className="h-[50vh] w-full rounded-2xl" />
              ) : (
                <MarkdownEditor
                  id="rule-body"
                  value={form.body}
                  onChange={(v) => set("body", v)}
                  label={t("admin.rules.form.body")}
                  hint={t("admin.templates.editor.bodyHint")}
                  invalid={touched && errors.body}
                  height="h-[52vh] min-h-[340px]"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" variant="gold" loading={saving} disabled={loadingBody}>
              {isNew ? t("common.actions.create") : t("common.actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
