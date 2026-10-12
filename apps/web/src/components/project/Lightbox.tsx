"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft2, ArrowRight2, CloseCircle, DocumentDownload } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type LightboxItem = { src: string; alt: string; caption?: string; download?: string };

/** Full-screen image viewer: keyboard (←/→/Esc), swipe, thumbnails strip, counter. */
export function Lightbox({
  items,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
}: {
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
}) {
  const { t } = useI18n();
  const [dir, setDir] = React.useState(0);
  const start = React.useRef<number | null>(null);
  const thumbs = React.useRef<HTMLDivElement>(null);
  const n = items.length;
  const item = items[index];

  const go = React.useCallback(
    (d: number) => {
      if (n < 2) return;
      setDir(d);
      onIndexChange((index + d + n) % n);
    },
    [index, n, onIndexChange],
  );

  React.useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index, open]);

  if (!item) return null;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-xl data-[state=open]:animate-[fadeIn_.25s_ease-out]" />
        <D.Content
          className="fixed inset-0 z-50 flex flex-col focus:outline-none data-[state=open]:animate-[fadeIn_.25s_ease-out]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
          }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
            <D.Title className="min-w-0 truncate text-sm font-medium text-stone-100">
              {title ?? item.alt}
              <span className="ml-3 font-mono text-xs text-ink-400">{t("catalog.detail.gallery.counter", { index: index + 1, total: n })}</span>
            </D.Title>
            <div className="flex items-center gap-1">
              {item.download && (
                <a
                  href={item.download}
                  className="grid size-10 place-items-center rounded-xl text-ink-200 transition hover:bg-fg/10 hover:text-stone-100"
                  aria-label={t("catalog.detail.gallery.download")}
                  title={t("catalog.detail.gallery.download")}
                >
                  <DocumentDownload size={20} />
                </a>
              )}
              <D.Close className="grid size-10 cursor-pointer place-items-center rounded-xl text-ink-200 transition hover:bg-fg/10 hover:text-stone-100" aria-label={t("common.actions.close")}>
                <CloseCircle size={22} />
              </D.Close>
            </div>
          </div>

          <div
            className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
            onPointerDown={(e) => (start.current = e.clientX)}
            onPointerUp={(e) => {
              if (start.current === null) return;
              const dx = e.clientX - start.current;
              start.current = null;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}
          >
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.figure
                key={item.src + index}
                custom={dir}
                initial={{ opacity: 0, x: dir * 80, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: dir * -80, scale: 0.98 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 pb-4 md:px-20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt} draggable={false} className="max-h-full min-h-0 max-w-full rounded-xl object-contain shadow-lift" />
                {item.caption && <figcaption className="max-w-2xl text-center text-sm text-ink-300">{item.caption}</figcaption>}
              </motion.figure>
            </AnimatePresence>
            {n > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={t("catalog.detail.gallery.prev")}
                  className="glass absolute left-3 top-1/2 z-10 grid size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-stone-100 shadow-card transition hover:scale-105 md:left-6"
                >
                  <ArrowLeft2 size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={t("catalog.detail.gallery.next")}
                  className="glass absolute right-3 top-1/2 z-10 grid size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-stone-100 shadow-card transition hover:scale-105 md:right-6"
                >
                  <ArrowRight2 size={20} />
                </button>
              </>
            )}
          </div>

          {n > 1 && (
            <div ref={thumbs} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 pt-1 md:justify-center md:px-6" aria-label={t("catalog.detail.gallery.thumbnails")}>
              {items.map((it, i) => (
                <button
                  key={it.src + i}
                  data-i={i}
                  type="button"
                  onClick={() => {
                    setDir(i > index ? 1 : -1);
                    onIndexChange(i);
                  }}
                  aria-current={i === index}
                  aria-label={t("catalog.detail.gallery.counter", { index: i + 1, total: n })}
                  className={cn(
                    "h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-300",
                    i === index ? "border-gold-400 opacity-100" : "border-transparent opacity-50 hover:opacity-90",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
