"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { CloseCircle } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";

/** Right-side drawer (Radix Dialog) with a spring slide-in; bottom sheet on small screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-onyx/55 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={
                  mobile
                    ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-line-strong bg-ink-900 shadow-lift focus:outline-none"
                    : "fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-line-strong bg-ink-900 shadow-lift focus:outline-none"
                }
                initial={mobile ? { y: "100%" } : { x: "100%" }}
                animate={mobile ? { y: 0 } : { x: 0 }}
                exit={mobile ? { y: "100%" } : { x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
              >
                {mobile && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink-600" aria-hidden />}
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div className="min-w-0">
                    <D.Title className="font-display text-3xl leading-tight text-stone-100">{title}</D.Title>
                    {description ? (
                      <D.Description className="mt-1 text-sm text-ink-300">{description}</D.Description>
                    ) : (
                      <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>
                    )}
                  </div>
                  <D.Close
                    className="cursor-pointer rounded-lg p-1.5 text-ink-300 transition hover:bg-fg/5 hover:text-stone-100"
                    aria-label={t("common.actions.close")}
                  >
                    <CloseCircle size={22} />
                  </D.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
