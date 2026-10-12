"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

// The first render (SSR + hydration) is never animated — the content must be visible at first paint.
// Every later client-side navigation between public pages fades/rises the new page in.
let hydrated = false;

export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [animate] = React.useState(() => hydrated && !reduce);
  React.useEffect(() => {
    hydrated = true;
  }, []);

  if (!animate) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
