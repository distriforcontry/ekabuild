"use client";
import { motion } from "motion/react";

/** Celebratory animated check with expanding rings and sparks. */
export function SuccessBurst({ size = 120 }: { size?: number }) {
  const sparks = Array.from({ length: 12 });
  return (
    <div className="relative grid place-items-center" style={{ width: size * 1.8, height: size * 1.8 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-success/40"
          style={{ width: size, height: size }}
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.6, delay: 0.25 + i * 0.35, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut" }}
        />
      ))}
      {sparks.map((_, i) => {
        const a = (i / sparks.length) * Math.PI * 2;
        const r = size * 0.85;
        return (
          <motion.span
            key={`s${i}`}
            className={i % 2 ? "absolute size-1.5 rounded-full bg-gold-400" : "absolute size-2 rounded-full bg-success"}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
      <motion.div
        className="relative grid place-items-center rounded-full bg-success/15 ring-1 ring-success/40"
        style={{ width: size, height: size }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <svg viewBox="0 0 52 52" style={{ width: size * 0.5, height: size * 0.5 }} fill="none" className="text-success">
          <motion.path
            d="M14 27 l8 8 l16 -18"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
