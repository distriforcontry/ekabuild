"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { PURCHASE_KINDS, type PurchaseKind } from "@eka/shared";
import { ArrowLeft, Book1, Copy, Danger, DocumentCopy, DocumentText, InfoCircle, Save2, SearchNormal1, TickCircle } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { slugify } from "./format";
import { useApiList } from "./hooks";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { ErrorNotice, Sheet, Switch } from "./primitives";
import type { TemplateItem } from "./types";

/** Placeholders the API substitutes when a contract is generated, with demo values for the preview. */
const PLACEHOLDERS: { group: "contract" | "buyer" | "seller" | "project" | "unit" | "money" | "payment" | "reservation"; items: { key: string; sample: string }[] }[] = [
  {
    group: "contract",
    items: [
      { key: "contract.number", sample: "EKA-2026-000128" },
      { key: "contract.date", sample: "12.10.2026" },
    ],
  },
  {
    group: "buyer",
    items: [
      { key: "buyer.fullName", sample: "Aliyev Jasur Bahodirovich" },
      { key: "buyer.phone", sample: "+998 90 123 45 67" },
      { key: "buyer.pinfl", sample: "31204857710023" },
      { key: "buyerOrg.name", sample: "«Orient Invest» MChJ" },
      { key: "buyerOrg.tin", sample: "305112784" },
    ],
  },
  {
    group: "seller",
    items: [
      { key: "seller.name", sample: "«EKA Construction» MChJ" },
      { key: "seller.tin", sample: "307654321" },
      { key: "seller.director", sample: "Karimov Bekzod Anvarovich" },
      { key: "seller.address", sample: "Toshkent sh., Mirzo Ulug'bek tumani, Buyuk Ipak yo'li ko'chasi, 51" },
    ],
  },
  {
    group: "project",
    items: [
      { key: "project.name", sample: "EKA Residence" },
      { key: "project.address", sample: "Toshkent sh., Yunusobod tumani, 14-mavze, 7-uy" },
      { key: "project.cadastreNumber", sample: "10:07:03:02:01:0045" },
    ],
  },
  {
    group: "unit",
    items: [
      { key: "unit.number", sample: "47" },
      { key: "unit.floor", sample: "9" },
      { key: "unit.area", sample: "78.4" },
      { key: "unit.rooms", sample: "3" },
      { key: "unit.section", sample: "2" },
    ],
  },
  {
    group: "money",
    items: [
      { key: "amount", sample: "845 000 000" },
      { key: "amountWords", sample: "sakkiz yuz qirq besh million" },
      { key: "currency", sample: "UZS" },
    ],
  },
  {
    group: "payment",
    items: [
      { key: "payment.plan", sample: "bo'lib to'lash: boshlang'ich to'lov 30% (253 500 000 so'm), qolgan qismi 12 oy davomida har oy teng ulushlarda" },
      { key: "payment.down", sample: "253 500 000 so'm" },
      { key: "payment.monthly", sample: "49 291 667 so'm" },
      { key: "payment.months", sample: "12" },
      { key: "payment.count", sample: "13" },
      { key: "payment.lastDate", sample: "12.10.2027" },
      {
        key: "payment.table",
        sample:
          "\n\n| № | To'lov | Muddati | Summa |\n|---|---|---|---|\n| 1 | Boshlang'ich to'lov (30%) | 17.10.2026 | 253 500 000 so'm |\n| 2 | 1-oy | 12.11.2026 | 49 291 667 so'm |\n| 3 | 2-oy | 12.12.2026 | 49 291 667 so'm |\n| … | … | … | … |\n\n",
      },
    ],
  },
  {
    group: "reservation",
    items: [{ key: "reservation.until", sample: "19.10.2026" }],
  },
];

const KNOWN = new Map(PLACEHOLDERS.flatMap((g) => g.items.map((i) => [i.key, i.sample] as const)));
const PH_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

type Form = { name: string; key: string; kind: PurchaseKind; active: boolean; body: string };

export function TemplateEditor({ id }: { id: string }) {
  const isNew = id === "new";
  const { t, label, raw } = useI18n();
  const router = useRouter();
  const list = useApiList<TemplateItem>(isNew ? null : "/admin/templates");
  const existing = isNew ? null : (list.items.find((x) => x.id === id) ?? null);

  const starter = raw<string>("admin.templates.editor.starter");
  const [form, setForm] = React.useState<Form>(() => ({ name: "", key: "", kind: "UNIT", active: true, body: isNew ? starter : "" }));
  const [baseline, setBaseline] = React.useState<Form | null>(isNew ? { name: "", key: "", kind: "UNIT", active: true, body: starter } : null);
  const [version, setVersion] = React.useState<number | null>(null);
  const [sample, setSample] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [keyEdited, setKeyEdited] = React.useState(!isNew);
  const editor = React.useRef<MarkdownEditorHandle>(null);
  const [cheatOpen, setCheatOpen] = React.useState(false);

  // hydrate once the template arrives
  React.useEffect(() => {
    if (!existing || baseline) return;
    const f: Form = { name: existing.name, key: existing.key, kind: existing.kind, active: existing.active, body: existing.body };
    setForm(f);
    setBaseline(f);
    setVersion(existing.version);
  }, [existing, baseline]);

  const dirty = baseline != null && JSON.stringify(form) !== JSON.stringify(baseline);

  // warn before leaving with unsaved changes
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const errors = {
    name: !form.name.trim(),
    key: !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(form.key),
    body: !form.body.trim(),
  };
  const invalid = errors.name || errors.key || errors.body;

  const unknown = React.useMemo(() => {
    const out = new Set<string>();
    for (const m of form.body.matchAll(PH_RE)) if (!KNOWN.has(m[1]!)) out.add(m[1]!);
    return [...out];
  }, [form.body]);

  const used = React.useMemo(() => new Set([...form.body.matchAll(PH_RE)].map((m) => m[1]!)), [form.body]);

  const previewTransform = React.useCallback(
    (md: string) =>
      md.replace(PH_RE, (m, key: string) => {
        if (sample && KNOWN.has(key)) return KNOWN.get(key)!;
        return `\`${m.replace(/\s+/g, "")}\``;
      }),
    [sample],
  );

  const save = React.useCallback(async () => {
    setTouched(true);
    if (invalid) {
      toast.error(t("admin.templates.editor.required"));
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), key: form.key.trim(), kind: form.kind, active: form.active, body: form.body };
      if (isNew) {
        const res = await api.post<TemplateItem | { template: TemplateItem }>("/admin/templates", body);
        const created = res && "template" in res ? res.template : (res as TemplateItem);
        setBaseline(form);
        toast.success(t("admin.templates.editor.created"));
        if (created?.id) router.replace(`/admin/templates/${created.id}`);
        else router.replace("/admin/templates");
      } else {
        const res = await api.patch<TemplateItem | { template: TemplateItem }>(`/admin/templates/${id}`, body);
        const updated = res && "template" in res ? res.template : (res as TemplateItem | undefined);
        setBaseline(form);
        if (updated?.version) setVersion(updated.version);
        toast.success(t("admin.templates.editor.saved"));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [form, id, invalid, isNew, router, t]);

  // ⌘S / Ctrl+S
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (!isNew && !list.loading && !existing) {
    return (
      <div>
        <BackLink />
        <ErrorNotice error={list.error} onRetry={list.reload} />
        {!list.error && (
          <EmptyState
            icon={DocumentText}
            title={t("admin.templates.editor.notFound")}
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/templates">{t("admin.templates.editor.back")}</Link>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const loading = !isNew && !baseline;

  return (
    <div>
      <BackLink />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{t("admin.nav.templates")}</div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-stone-100 md:text-3xl">
            {isNew ? t("admin.templates.editor.newTitle") : loading ? <Skeleton className="h-8 w-72" /> : form.name || t("admin.templates.editor.editTitle")}
            {version != null && <Badge tone="gold">{t("admin.templates.editor.version", { n: version })}</Badge>}
            {form.key.startsWith("annex-") && <Badge tone="info">{t("admin.control.templates.annex")}</Badge>}
          </h1>
          {!isNew && <p className="mt-2 max-w-2xl text-xs text-ink-400">{t("admin.control.templates.versionNote")}</p>}
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={dirty ? "dirty" : "clean"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn("inline-flex items-center gap-1.5 text-xs", dirty ? "text-warning" : "text-ink-400")}
            >
              {dirty ? <span className="size-1.5 rounded-full bg-warning" /> : <TickCircle size={14} className="text-success" />}
              {dirty ? t("admin.templates.editor.unsaved") : t("admin.templates.editor.allSaved")}
            </motion.span>
          </AnimatePresence>
          <Button variant="gold" onClick={save} loading={saving} disabled={loading || (!dirty && !isNew)}>
            {!saving && <Save2 />} {t("common.actions.save")}
            <kbd className="ml-1 hidden rounded border border-onyx/20 px-1 font-mono text-[10px] sm:inline">⌘S</kbd>
          </Button>
        </div>
      </div>

      <ErrorNotice error={list.error} onRetry={list.reload} />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-[56vh] w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-end">
              <Field label={t("admin.templates.editor.name")} htmlFor="tpl-name" error={touched && errors.name ? t("common.errors.required") : undefined}>
                <Input
                  id="tpl-name"
                  value={form.name}
                  placeholder={t("admin.templates.editor.namePlaceholder")}
                  aria-invalid={touched && errors.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, key: keyEdited ? f.key : slugKey(name) }));
                  }}
                />
              </Field>
              <Field label={t("admin.templates.editor.key")} htmlFor="tpl-key" hint={t("admin.templates.editor.keyHint")} error={touched && errors.key ? t("admin.templates.editor.keyHint") : undefined}>
                <Input
                  id="tpl-key"
                  value={form.key}
                  className="font-mono"
                  aria-invalid={touched && errors.key}
                  onChange={(e) => {
                    setKeyEdited(true);
                    set("key", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
                  }}
                />
              </Field>
              <Field label={t("admin.templates.editor.kind")}>
                <Combobox
                  options={PURCHASE_KINDS.map((k) => ({ value: k, label: label("purchaseKind", k) }))}
                  value={form.kind}
                  onChange={(v) => v && set("kind", v as PurchaseKind)}
                  clearable={false}
                  searchable={false}
                />
              </Field>
              <div className="flex h-11 items-center gap-3 rounded-xl border border-line bg-ink-850 px-3.5 xl:mb-0">
                <Switch id="tpl-active" checked={form.active} onCheckedChange={(v) => set("active", v)} aria-label={t("admin.templates.editor.active")} />
                <div className="leading-tight">
                  <div className="text-sm font-medium text-stone-100">{t("admin.templates.editor.active")}</div>
                  <div className="text-[11px] text-ink-400">{t("admin.templates.editor.activeHint")}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* placeholder chips */}
          <Card className="mb-4">
            <CardContent className="py-4 md:py-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-ink-200">{t("admin.templates.editor.placeholders")}</span>
                <span className="flex items-center gap-3">
                  <span className="hidden text-[11px] text-ink-400 sm:inline">{t("admin.templates.editor.placeholdersHint")}</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setCheatOpen(true)}>
                    <Book1 variant="Bulk" className="text-gold-300" /> {t("admin.control.templates.cheat.button")}
                  </Button>
                </span>
              </div>
              {form.key.startsWith("annex-") && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-info/25 bg-info/[0.06] px-3 py-2 text-xs text-ink-200">
                  <DocumentCopy size={14} variant="Bulk" className="mt-px shrink-0 text-info" /> {t("admin.control.templates.annexHint")}
                </div>
              )}
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-x-6">
                {PLACEHOLDERS.map((g) => (
                  <div key={g.group} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 w-full text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 lg:w-auto">
                      {t(`admin.control.templates.groups.${g.group}` as MessageKey)}
                    </span>
                    {g.items.map((p) => {
                      const isUsed = used.has(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => editor.current?.insert(`{{${p.key}}}`)}
                          title={`${t(`admin.control.templates.ph.${p.key.replace(/\./g, "_")}` as MessageKey)} — ${p.sample.trim().split("\n")[0]}`}
                          className={cn(
                            "inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2 font-mono text-[11px] transition hover:-translate-y-px active:scale-95",
                            isUsed
                              ? "border-gold-500/40 bg-gold-500/10 text-gold-200 hover:border-gold-400"
                              : "border-line bg-ink-850 text-ink-300 hover:border-gold-500/40 hover:text-gold-200",
                          )}
                        >
                          {isUsed && <span className="size-1 rounded-full bg-gold-400" />}
                          {`{{${p.key}}}`}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <AnimatePresence>
                {unknown.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2 text-xs text-warning">
                      <Danger size={14} variant="Bold" />
                      {t("admin.templates.editor.unknown")}
                      {unknown.map((u) => (
                        <code key={u} className="rounded bg-warning/10 px-1.5 py-0.5 font-mono">{`{{${u}}}`}</code>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <MarkdownEditor
            ref={editor}
            id="tpl-body"
            value={form.body}
            onChange={(v) => set("body", v)}
            label={t("admin.templates.editor.body")}
            hint={t("admin.templates.editor.bodyHint")}
            invalid={touched && errors.body}
            previewTransform={previewTransform}
            previewHeader={
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-300">
                <Switch size="sm" checked={sample} onCheckedChange={setSample} aria-label={t("admin.templates.editor.sample")} />
                {t("admin.templates.editor.sample")}
              </label>
            }
            height="h-[68vh] min-h-[420px]"
          />
        </>
      )}
      <CheatSheet
        open={cheatOpen}
        onOpenChange={setCheatOpen}
        used={used}
        onInsert={(key) => {
          editor.current?.insert(`{{${key}}}`);
          setCheatOpen(false);
        }}
      />
    </div>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link href="/admin/templates" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-400 transition hover:text-gold-300">
      <ArrowLeft size={16} /> {t("admin.templates.editor.back")}
    </Link>
  );
}

const slugKey = (s: string) => slugify(s).slice(0, 48);

/** Every placeholder the API substitutes, with its meaning and a sample value; copy or insert at the cursor. */
function CheatSheet({ open, onOpenChange, used, onInsert }: { open: boolean; onOpenChange: (o: boolean) => void; used: Set<string>; onInsert: (key: string) => void }) {
  const { t } = useI18n();
  const [q, setQ] = React.useState("");
  const [copied, setCopied] = React.useState<string | null>(null);
  const meaning = (key: string) => t(`admin.control.templates.ph.${key.replace(/\./g, "_")}` as MessageKey);
  const needle = q.trim().toLowerCase();
  const groups = PLACEHOLDERS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !needle || i.key.toLowerCase().includes(needle) || meaning(i.key).toLowerCase().includes(needle)),
  })).filter((g) => g.items.length);

  const copy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {}
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("admin.control.templates.cheat.title")} description={t("admin.control.templates.cheat.description")} width="max-w-2xl">
      <div className="relative mb-4">
        <SearchNormal1 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("admin.control.templates.cheat.search")}
          aria-label={t("admin.control.templates.cheat.search")}
          className="h-10 w-full rounded-xl border border-line bg-ink-850 pl-9 pr-3 text-sm text-stone-100 placeholder:text-ink-400 focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10"
        />
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.group}>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{t(`admin.control.templates.groups.${g.group}` as MessageKey)}</h4>
            <ul className="overflow-hidden rounded-2xl border border-line">
              {g.items.map((i) => (
                <li key={i.key} className="group flex items-start gap-3 border-b border-line bg-ink-900 px-3.5 py-3 last:border-0 hover:bg-fg/[0.025]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[11.5px]", used.has(i.key) ? "border-gold-500/40 bg-gold-500/10 text-gold-200" : "border-line bg-ink-850 text-ink-100")}>{`{{${i.key}}}`}</code>
                      <span className="text-sm text-ink-200">{meaning(i.key)}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-ink-400">
                      <span className="text-ink-500">{t("admin.control.templates.cheat.sample")}: </span>
                      {i.sample.trim()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copy(i.key)}
                      aria-label={t("admin.control.templates.cheat.copy")}
                      title={copied === i.key ? t("admin.control.templates.cheat.copied") : t("admin.control.templates.cheat.copy")}
                      className={cn("grid size-8 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:bg-fg/6 hover:text-stone-100", copied === i.key && "text-success hover:text-success")}
                    >
                      {copied === i.key ? <TickCircle size={16} variant="Bold" /> : <Copy size={16} />}
                    </button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onInsert(i.key)}>
                      {t("admin.control.templates.cheat.insert")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-400">
            <InfoCircle size={16} /> —
          </p>
        )}
      </div>
    </Sheet>
  );
}
