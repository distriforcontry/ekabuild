"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft2, ArrowRight2, Gallery as GalleryIcon, Maximize4 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { CoverPlaceholder } from "@/components/catalog/ProjectCover";
import { Lightbox } from "./Lightbox";
import { apiImg, apiSrcSet } from "@/components/marketing/img";

/** Hero gallery: main image with crossfade, arrows, thumbnails, lightbox. */
export function Gallery({ images, name, seed, floors }: { images: string[]; name: string; seed: string; floors: number }) {
  const { t } = useI18n();
  const [i, setI] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const n = images.length;
  const src = images[i];
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const visibleThumbs = images.slice(0, 5);

  return (
    <div>
      <div className="eka-dark group relative aspect-[16/11] overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card">
        {/* true crossfade: the outgoing image stays while the next one fades in over it with a slow push-in */}
        <AnimatePresence initial={false}>
          <motion.button
            key={src}
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.25 } }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 block size-full cursor-zoom-in overflow-hidden"
            aria-label={t("catalog.detail.gallery.open")}
          >
            {src && !broken.has(src) ? (
              <motion.span
                className="block size-full"
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={apiImg(src, 1600)}
                  srcSet={apiSrcSet(src, [768, 1024, 1600])}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  alt={`${name} — ${i + 1}`}
                  decoding="async"
                  className="size-full object-cover transition-[scale] duration-[1500ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                  fetchPriority={i === 0 ? "high" : "auto"}
                  onError={() => setBroken((b) => new Set(b).add(src))}
                />
              </motion.span>
            ) : (
              <CoverPlaceholder name={name} seed={seed} floors={floors} />
            )}
          </motion.button>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/50 via-transparent to-transparent" />

        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-100">
            <GalleryIcon size={14} variant="Bulk" className="text-gold-300" />
            {t("catalog.detail.gallery.counter", { index: i + 1, total: n })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass absolute bottom-4 right-4 grid size-10 cursor-pointer place-items-center rounded-full text-stone-100 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={t("catalog.detail.gallery.open")}
        >
          <Maximize4 size={18} className="text-gold-200" />
        </button>
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("catalog.detail.gallery.prev")}
              className="glass absolute left-4 top-1/2 grid size-11 -translate-y-1/2 -translate-x-2 cursor-pointer place-items-center rounded-full text-stone-100 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowLeft2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("catalog.detail.gallery.next")}
              className="glass absolute right-4 top-1/2 grid size-11 -translate-y-1/2 translate-x-2 cursor-pointer place-items-center rounded-full text-stone-100 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowRight2 size={18} />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 md:gap-3" aria-label={t("catalog.detail.gallery.thumbnails")}>
          {visibleThumbs.map((s, k) => {
            const more = k === 4 && n > 5;
            return (
              <button
                key={s + k}
                type="button"
                onClick={() => (more ? (setI(k), setOpen(true)) : setI(k))}
                aria-current={k === i}
                aria-label={t("catalog.detail.gallery.counter", { index: k + 1, total: n })}
                className={cn(
                  "group/th relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl transition-opacity duration-300",
                  k === i ? "opacity-100" : "opacity-65 hover:opacity-100",
                )}
              >
                {broken.has(s) ? (
                  <CoverPlaceholder name={name} seed={seed + k} floors={floors} showInitial={false} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={apiImg(s, 480)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-[scale] duration-700 group-hover/th:scale-105"
                    onError={() => setBroken((b) => new Set(b).add(s))}
                  />
                )}
                {k === i && (
                  <motion.span
                    layoutId="eka-gallery-thumb"
                    className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-gold-400 shadow-glow"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                {more && (
                  <span className="absolute inset-0 grid place-items-center bg-ink-950/70 font-mono text-sm font-semibold text-stone-100 backdrop-blur-[2px]">
                    +{n - 5}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Lightbox
        items={images.map((s, k) => ({ src: s, alt: `${name} — ${k + 1}`, download: `${s}${s.includes("?") ? "&" : "?"}download=1` }))}
        index={i}
        onIndexChange={setI}
        open={open}
        onOpenChange={setOpen}
        title={name}
      />
    </div>
  );
}
