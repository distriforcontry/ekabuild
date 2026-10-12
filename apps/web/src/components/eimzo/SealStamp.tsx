"use client";
import { useId } from "react";
import { motion } from "motion/react";

/** Animated "signed" seal — thumps onto the page like a rubber stamp. */
export function SealStamp({ label, size = 168, date }: { label: string; size?: number; date?: string }) {
  const id = useId().replace(/:/g, "");
  const ring = `seal-ring-${id}`;
  const text = `EKA BUILD • E-IMZO • ${label} • `;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gold-500/25 blur-2xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.9, 0.4], scale: [0.6, 1.25, 1.1] }}
        transition={{ duration: 0.9, delay: 0.35 }}
      />
      <motion.svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="relative text-gold-400"
        initial={{ scale: 2.4, rotate: -40, opacity: 0 }}
        animate={{ scale: 1, rotate: -12, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16, mass: 0.9, delay: 0.1 }}
        role="img"
        aria-label={label}
      >
        <defs>
          <path id={ring} d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
        </defs>
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" />
        <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="2" />
        <text fill="currentColor" fontSize="14" fontWeight="800" fontFamily="'Manrope Variable', Manrope, sans-serif">
          <textPath href={`#${ring}`} textLength={444} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
        <motion.path
          d="M76 102 l16 16 l34 -36"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.55, ease: "easeOut" }}
        />
        {date && (
          <text x="100" y="146" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700" letterSpacing="1.5" fontFamily="'JetBrains Mono Variable', monospace">
            {date}
          </text>
        )}
      </motion.svg>
    </div>
  );
}
