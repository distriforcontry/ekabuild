"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, Edit2, LinkSquare, Minus, QuoteDown, RowVertical, TextBold, TextItalic, Hashtag, TaskSquare } from "iconsax-reactjs";
import type { Icon as IconType } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type MarkdownEditorHandle = {
  /** insert text at the caret (or replace the selection) and keep focus */
  insert: (text: string) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** transform markdown before preview (e.g. substitute {{placeholders}}) */
  previewTransform?: (md: string) => string;
  previewHeader?: React.ReactNode;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  height?: string;
  invalid?: boolean;
  placeholder?: string;
};

/** Monospace markdown editor with a formatting bar and live side-by-side preview (tabs on small screens). */
export const MarkdownEditor = React.forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value, onChange, previewTransform, previewHeader, label, hint, id, height = "h-[56vh] min-h-[360px]", invalid, placeholder },
  ref,
) {
  const { t } = useI18n();
  const area = React.useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const deferred = React.useDeferredValue(value);
  const preview = React.useMemo(() => (previewTransform ? previewTransform(deferred) : deferred), [deferred, previewTransform]);
  const words = React.useMemo(() => (value.trim() ? value.trim().split(/\s+/).length : 0), [value]);

  const replaceSelection = React.useCallback(
    (fn: (selected: string) => { text: string; cursorOffset?: number; selectInner?: boolean }) => {
      const el = area.current;
      if (!el) return;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const selected = value.slice(start, end);
      const { text, cursorOffset, selectInner } = fn(selected);
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        if (selectInner && selected) el.setSelectionRange(start, start + text.length);
        else {
          const pos = start + (cursorOffset ?? text.length);
          el.setSelectionRange(pos, pos);
        }
      });
    },
    [value, onChange],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      insert: (text) => replaceSelection(() => ({ text })),
      focus: () => area.current?.focus(),
    }),
    [replaceSelection],
  );

  const wrap = (before: string, after = before, fallback = "") =>
    replaceSelection((sel) => {
      const inner = sel || fallback;
      return { text: `${before}${inner}${after}`, cursorOffset: before.length + inner.length, selectInner: Boolean(sel) };
    });
  const linePrefix = (prefix: string) =>
    replaceSelection((sel) => {
      const lines = (sel || "").split("\n");
      const text = lines.map((l) => `${prefix}${l}`).join("\n");
      return { text, cursorOffset: text.length };
    });

  const word = t("admin.templates.editor.snippet.text");
  const tools: { icon: IconType; label: string; run: () => void }[] = [
    { icon: Hashtag, label: t("admin.templates.editor.tools.heading"), run: () => linePrefix("## ") },
    { icon: TextBold, label: t("admin.templates.editor.tools.bold"), run: () => wrap("**", "**", word) },
    { icon: TextItalic, label: t("admin.templates.editor.tools.italic"), run: () => wrap("_", "_", word) },
    { icon: TaskSquare, label: t("admin.templates.editor.tools.list"), run: () => linePrefix("- ") },
    { icon: QuoteDown, label: t("admin.templates.editor.tools.quote"), run: () => linePrefix("> ") },
    { icon: LinkSquare, label: t("admin.templates.editor.tools.link"), run: () => wrap("[", "](https://)", t("admin.templates.editor.snippet.link")) },
    {
      icon: RowVertical,
      label: t("admin.templates.editor.tools.table"),
      run: () => replaceSelection(() => ({ text: `\n| ${t("admin.templates.editor.snippet.col")} | ${t("admin.templates.editor.snippet.value")} |\n|---|---|\n| | |\n` })),
    },
    { icon: Minus, label: t("admin.templates.editor.tools.rule"), run: () => replaceSelection(() => ({ text: "\n\n---\n\n" })) },
  ];

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      e.stopPropagation(); // don't let ⌘B also toggle the sidebar
      wrap("**", "**", word);
    } else if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrap("_", "_", word);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      replaceSelection(() => ({ text: "  " }));
    }
  };

  return (
    <div>
      {(label || hint) && (
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-xs font-semibold tracking-wide text-ink-200">
              {label}
            </label>
          )}
          {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
        </div>
      )}
      {/* mobile tabs */}
      <div className="mb-2 inline-flex rounded-xl border border-line bg-ink-850 p-1 lg:hidden" role="tablist">
        {(["edit", "preview"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition", tab === k ? "bg-ink-700 text-stone-100" : "text-ink-300")}
          >
            {k === "edit" ? <Edit2 size={14} /> : <Eye size={14} />}
            {k === "edit" ? t("admin.templates.editor.editTab") : t("admin.templates.editor.previewTab")}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-3 lg:grid-cols-2", height)}>
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-ink-850 transition focus-within:border-gold-500/60 focus-within:ring-4 focus-within:ring-gold-500/10",
            invalid ? "border-danger/60" : "border-line",
            tab === "preview" && "hidden lg:flex",
          )}
        >
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5 [scrollbar-width:none]">
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={tool.run}
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-300 transition hover:bg-fg/6 hover:text-gold-200"
              >
                <tool.icon size={16} />
              </button>
            ))}
            <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-ink-500">{t("admin.templates.editor.words", { n: words })}</span>
          </div>
          <textarea
            ref={area}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-stone-100 placeholder:text-ink-500 focus:outline-none"
          />
        </div>
        <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-ink-900", tab === "edit" && "hidden lg:flex")}>
          <div className="flex h-[45px] items-center justify-between gap-2 border-b border-line px-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">
              <Eye size={14} /> {t("admin.templates.editor.preview")}
            </span>
            {previewHeader}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-7">
            {preview.trim() ? (
              <article className="prose-eka text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
              </article>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-ink-500">{t("admin.templates.editor.emptyPreview")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
