"use client";
import type { Icon as IconType } from "iconsax-reactjs";
import { Document, DocumentCode, DocumentText, Gallery, I3Dcube, Video, Archive } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

type Kind = "pdf" | "image" | "model" | "cad" | "video" | "archive" | "other";

export function fileKind(mime?: string | null, name?: string | null): Kind {
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(n)) return "image";
  if (m.startsWith("video/") || /\.(mp4|webm|mov)$/.test(n)) return "video";
  if (m.includes("gltf") || /\.(glb|gltf)$/.test(n)) return "model";
  if (/\.(dwg|dxf|ifc)$/.test(n)) return "cad";
  if (m.includes("zip") || n.endsWith(".zip")) return "archive";
  return "other";
}

const META: Record<Kind, { icon: IconType; cls: string; label: string }> = {
  pdf: { icon: DocumentText, cls: "border-danger/25 bg-danger/10 text-danger", label: "PDF" },
  image: { icon: Gallery, cls: "border-info/25 bg-info/10 text-info", label: "IMG" },
  video: { icon: Video, cls: "border-info/25 bg-info/10 text-info", label: "VID" },
  model: { icon: I3Dcube, cls: "border-gold-500/30 bg-gold-500/10 text-gold-300", label: "3D" },
  cad: { icon: DocumentCode, cls: "border-success/25 bg-success/10 text-success", label: "CAD" },
  archive: { icon: Archive, cls: "border-warning/25 bg-warning/10 text-warning", label: "ZIP" },
  other: { icon: Document, cls: "border-line-strong bg-fg/5 text-ink-300", label: "FILE" },
};

/** Coloured square icon describing a file type. */
export function FileTypeIcon({ mime, name, size = "md", className }: { mime?: string | null; name?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = META[fileKind(mime, name)];
  const Icon = meta.icon;
  const dim = size === "lg" ? "size-12 rounded-xl" : size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  return (
    <span className={cn("relative grid shrink-0 place-items-center border", dim, meta.cls, className)} title={meta.label}>
      <Icon size={size === "lg" ? 22 : size === "sm" ? 15 : 18} variant="Bulk" />
    </span>
  );
}
