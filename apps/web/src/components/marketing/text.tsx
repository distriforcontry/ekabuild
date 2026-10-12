import * as React from "react";
import { cn } from "@/lib/utils";
import { InView } from "./motion";

/**
 * Word-mask text reveal. Server-safe (no hooks): renders each word inside an overflow mask; the CSS in
 * globals.css (.eka-word) slides it up. Above the fold it plays on first paint (and waits for the intro via
 * --gate); inside `.eka-words-iv` it waits for an <InView> ancestor.
 */
export function SplitWords({ text, start = 0, wordClassName }: { text: string; start?: number; wordClassName?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <span className="eka-word">
            <span style={{ "--i": start + i } as React.CSSProperties}>{wordClassName ? <span className={wordClassName}>{w}</span> : w}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </>
  );
}

export const wordCount = (s?: string | null) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

/** Section heading with an in-view word reveal, drawn gold rule and fading description. */
export function RevealHeading({
  eyebrow,
  title,
  accent,
  description,
  align = "left",
  className,
  as: H = "h2",
  size = "lg",
  onImage = false,
  id,
}: {
  eyebrow?: string;
  title: string;
  /** words appended in gold italic */
  accent?: string;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
  size?: "md" | "lg" | "xl";
  /** text sits on a dark render (banners) */
  onImage?: boolean;
  id?: string;
}) {
  const n = wordCount(title);
  return (
    <InView className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <div className={cn("mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em]", onImage ? "text-gold-200" : "text-gold-400")}>
          <span className="eka-iv-draw h-px w-8 bg-gold-500/70" />
          <span className="eka-iv-fade" style={{ "--d": "120ms" } as React.CSSProperties}>
            {eyebrow}
          </span>
        </div>
      )}
      <H
        id={id}
        className={cn(
          "eka-words-iv font-display font-medium leading-[1.04] tracking-[-0.01em]",
          size === "md" && "text-3xl md:text-5xl",
          size === "lg" && "text-4xl md:text-6xl",
          size === "xl" && "text-[44px] sm:text-6xl md:text-7xl",
          onImage ? "eka-on-image" : "text-stone-100",
        )}
      >
        <SplitWords text={title} />
        {accent && (
          <>
            {" "}
            <SplitWords text={accent} start={n} wordClassName={cn("italic", onImage ? "text-gold-shimmer" : "text-gold-gradient")} />
          </>
        )}
      </H>
      {description && (
        <p
          className={cn("eka-iv-up mt-5 text-base leading-relaxed md:text-lg", onImage ? "eka-on-image-muted" : "text-ink-300")}
          style={{ "--d": `${Math.min(n + wordCount(accent), 10) * 55 + 120}ms` } as React.CSSProperties}
        >
          {description}
        </p>
      )}
    </InView>
  );
}
