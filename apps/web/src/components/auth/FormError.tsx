"use client";
import { AnimatePresence, motion } from "motion/react";
import { Danger } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

/** Animated inline error banner for forms. */
export function FormError({ message, className }: { message: string | null | undefined; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={cn("overflow-hidden", className)}
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger">
            <Danger size={18} variant="Bulk" className="mt-px shrink-0" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small field-level error text. */
export function FieldError({ message, id }: { message?: string | null; id?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-1.5 text-xs text-danger"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
