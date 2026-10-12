"use client";
import Link from "next/link";
import { ArrowLeft2, ArrowRight2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

function pageList(cur: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, cur - 1);
  const end = Math.min(pages - 1, cur + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

/** Link-based pagination (works without JS, preserves filters). */
export function Pagination({
  page,
  pages,
  hrefFor,
  onNavigate,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  onNavigate?: (page: number) => void;
}) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const link = (p: number) => ({
    href: hrefFor(p),
    scroll: false,
    onClick: (e: React.MouseEvent) => {
      if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        onNavigate(p);
      }
    },
  });
  const btn =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 font-mono text-sm transition-all duration-300";

  return (
    <nav aria-label={t("catalog.pagination.label")} className="mt-12 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link {...link(page - 1)} aria-label={t("catalog.pagination.prev")} className={cn(btn, "border-line text-ink-200 hover:border-line-strong hover:bg-fg/5")}>
          <ArrowLeft2 size={16} />
        </Link>
      ) : (
        <span className={cn(btn, "border-line text-ink-500 opacity-50")} aria-hidden>
          <ArrowLeft2 size={16} />
        </span>
      )}
      {pageList(page, pages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            {...link(p)}
            aria-label={t("catalog.pagination.page", { page: p })}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              btn,
              p === page
                ? "border-gold-500/40 bg-gold-500/12 text-gold-200 shadow-glow"
                : "border-transparent text-ink-300 hover:border-line hover:bg-fg/5 hover:text-stone-100",
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link {...link(page + 1)} aria-label={t("catalog.pagination.next")} className={cn(btn, "border-line text-ink-200 hover:border-line-strong hover:bg-fg/5")}>
          <ArrowRight2 size={16} />
        </Link>
      ) : (
        <span className={cn(btn, "border-line text-ink-500 opacity-50")} aria-hidden>
          <ArrowRight2 size={16} />
        </span>
      )}
    </nav>
  );
}
