"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "gold" }: { value: number; className?: string; tone?: "gold" | "success" | "info" }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = tone === "gold" ? "bg-gold-gradient" : tone === "success" ? "bg-success" : "bg-info";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-fg/8", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn("h-full rounded-full", bar)}
        initial={{ width: 0 }}
        whileInView={{ width: `${v}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
