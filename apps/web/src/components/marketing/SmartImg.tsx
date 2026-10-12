"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * <img> that fades/sharpens in from a blurred placeholder (or a shimmering skeleton) once decoded.
 * Works with SSR: an image that finished loading before hydration is detected via `complete`.
 * `priority` images (LCP) skip the fade and paint as soon as the bytes arrive; without JS every image is
 * shown anyway (`html:not([data-js]) .eka-img` in globals.css).
 */
export function SmartImg({
  src,
  srcSet,
  sizes,
  alt = "",
  lqip,
  className,
  imgClassName,
  priority = false,
  skeleton = true,
  onError,
  style,
  imgStyle,
  width,
  height,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt?: string;
  /** tiny blurred data-URI shown until the real image is ready */
  lqip?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  skeleton?: boolean;
  onError?: () => void;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  width?: number;
  height?: number;
}) {
  const ref = React.useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} style={style}>
      {!loaded &&
        (lqip ? (
          <div aria-hidden className="absolute inset-0 scale-110 bg-cover bg-center blur-xl" style={{ backgroundImage: `url("${lqip}")` }} />
        ) : skeleton ? (
          <div aria-hidden className="skeleton absolute inset-0" />
        ) : null)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={onError}
        data-loaded={loaded ? "" : undefined}
        // priority (LCP) images are visible straight from the server HTML — no JS-driven fade
        className={cn(!priority && "eka-img", "absolute inset-0 size-full object-cover", imgClassName)}
        style={imgStyle}
      />
    </div>
  );
}
