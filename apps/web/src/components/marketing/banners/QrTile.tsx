"use client";
import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { TickCircle } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

/**
 * QR motif: a real QR (to /verify) engraved in gold on graphite glass, corner brackets,
 * a scanning beam sweeping over it and a "verified" chip — the visual language of a certificate check.
 */
export function QrTile({
  value = "https://ekabuild.uz/verify",
  label,
  verifiedText,
  scanningText,
  size = "lg",
  className,
}: {
  value?: string;
  label: string;
  verifiedText?: string;
  scanningText?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const px = size === "lg" ? 196 : 76;
  const pad = size === "lg" ? "p-6" : "p-2.5";
  return (
    <div className={cn("relative isolate", className)} role="img" aria-label={label}>
      <div className={cn("relative overflow-hidden rounded-[22%] border border-[#e9d5a8]/25 bg-[#111112]/90 shadow-[0_30px_80px_-30px_rgb(201_164_100/0.55)]", pad, size === "sm" && "rounded-2xl")}>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(201_164_100/0.2),transparent_60%)]" />
        <QRCodeSVG value={value} size={px} level="M" bgColor="transparent" fgColor="#d9bb7c" marginSize={0} className="relative block" />
        {/* corner brackets */}
        {(["left-2 top-2 border-l-2 border-t-2", "right-2 top-2 border-r-2 border-t-2", "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"] as const).map((c) => (
          <span key={c} aria-hidden className={cn("absolute rounded-[3px] border-[#f1dfb2]", size === "lg" ? "size-6" : "size-3", c)} />
        ))}
        {/* scanning beam */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full">
          <div className="eka-scan absolute inset-x-3 top-2 h-8" style={{ "--scan": `${px + (size === "lg" ? 8 : 0)}px` } as React.CSSProperties}>
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#fff1cc] shadow-[0_0_14px_3px_rgb(233_213_168/0.75)]" />
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent to-[#e9d5a8]/20" />
          </div>
        </div>
      </div>
      {size === "lg" && (verifiedText || scanningText) && (
        <div className="eka-float absolute -bottom-5 left-1/2 -translate-x-1/2" style={{ "--fd": "-2s" } as React.CSSProperties}>
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#3fb68b]/35 bg-[#0e1512]/90 px-3.5 py-1.5 text-xs font-semibold text-[#5fd3a6] shadow-lift backdrop-blur-md">
            <TickCircle size={16} variant="Bold" />
            {verifiedText}
          </div>
        </div>
      )}
      {size === "lg" && scanningText && (
        <div className="absolute -top-4 right-2 flex items-center gap-1.5 rounded-full border border-[#e9d5a8]/25 bg-[#111112]/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#e0c285] backdrop-blur-md">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#e0c285] opacity-70" />
            <span className="relative size-1.5 rounded-full bg-[#e0c285]" />
          </span>
          {scanningText}
        </div>
      )}
    </div>
  );
}
