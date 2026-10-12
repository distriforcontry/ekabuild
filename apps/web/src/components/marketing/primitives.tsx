import * as React from "react";
import Link from "next/link";
import { ArrowRight2 } from "iconsax-reactjs";
import { cn } from "@/lib/utils";
import { SplitWords, wordCount } from "./text";

/** Centered page container used by every marketing section. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Decorative blueprint grid + gold glows. Parent must be `relative isolate`. */
export function Backdrop({ className, grid = true, intensity = "md" }: { className?: string; grid?: boolean; intensity?: "sm" | "md" | "lg" }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {grid && (
        <div className="bg-blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_10%,transparent_75%)]" />
      )}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full bg-gold-500 blur-[120px]",
          intensity === "lg" ? "-top-48 h-[560px] w-[1000px] opacity-[0.16]" : intensity === "md" ? "-top-56 h-[480px] w-[860px] opacity-[0.11]" : "-top-64 h-[380px] w-[680px] opacity-[0.08]",
        )}
      />
      <div className="absolute -right-40 top-24 size-[420px] rounded-full bg-gold-300 opacity-[0.05] blur-[110px]" />
      <div className="bg-noise absolute inset-0 opacity-70" />
    </div>
  );
}

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-6 text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-ink-400">
        {items.map((c, i) => (
          <li key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight2 size={12} className="text-ink-500" aria-hidden />}
            {c.href ? (
              <Link href={c.href} className="rounded transition hover:text-gold-300">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[46ch] truncate text-ink-200">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Inner-page hero: sits under the transparent header (-mt-20) with blueprint + glow backdrop.
 * The entrance is CSS-driven (plays from the first paint, no hydration wait): eyebrow rule draws,
 * a string title reveals word by word through a mask, description and children rise after it.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  crumbs,
  children,
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  const words = typeof title === "string" ? wordCount(title) : 4;
  const after = (ms: number) => ({ "--d": `${Math.min(words, 10) * 60 + ms}ms` }) as React.CSSProperties;
  return (
    <section className={cn("relative isolate -mt-20 overflow-hidden pt-32 pb-12 md:pt-40 md:pb-16", className)}>
      <Backdrop />
      <Container className={cn(align === "center" && "text-center")}>
        {crumbs && (
          <div className="eka-in-fade">
            <Breadcrumbs items={crumbs} className={cn(align === "center" && "flex justify-center")} />
          </div>
        )}
        {eyebrow && (
          <div className="mb-5 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">
            <span className="eka-draw-x h-px w-8 bg-gold-500/70" />
            <span className="eka-in" style={{ "--d": "80ms" } as React.CSSProperties}>
              {eyebrow}
            </span>
          </div>
        )}
        <h1
          className={cn(
            "max-w-4xl font-display text-[42px] font-medium leading-[1.02] tracking-[-0.01em] text-stone-100 sm:text-6xl md:text-7xl",
            align === "center" && "mx-auto",
          )}
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          {typeof title === "string" ? <SplitWords text={title} /> : <span className="eka-in block">{title}</span>}
        </h1>
        {description && (
          <p className={cn("eka-in mt-6 max-w-2xl text-base leading-relaxed text-ink-300 md:text-lg", align === "center" && "mx-auto")} style={after(200)}>
            {description}
          </p>
        )}
        {children && (
          <div className="eka-in" style={after(320)}>
            {children}
          </div>
        )}
      </Container>
    </section>
  );
}

/** Thin gold divider with a diamond in the middle. */
export function GoldDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
      <span className="size-1.5 rotate-45 bg-gold-400" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/40" />
    </div>
  );
}
