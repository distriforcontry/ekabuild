"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { DocumentText, Home2, ShieldTick, TickCircle } from "iconsax-reactjs";
import type { ProjectDetail, PurchaseItem, UnitItem } from "@/lib/types";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/misc";
import { useFormat } from "@/components/catalog/use-format";
import { DEFAULT_PLAN, PlanPicker, type PlanChoice } from "./InstallmentCalculator";

export type PurchaseTarget = { kind: "UNIT"; unit: UnitItem } | { kind: "DOCUMENT_PACKAGE" };

/** Confirm & create a purchase (unit reservation or document package) → /app/purchases/:id */
export function PurchaseDialog({
  project,
  target,
  onClose,
  onUnavailable,
  loginHref,
}: {
  project: ProjectDetail;
  target: PurchaseTarget | null;
  onClose: () => void;
  onUnavailable: () => void;
  loginHref: (hash?: string) => string;
}) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const router = useRouter();
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [plan, setPlan] = React.useState<PlanChoice>(DEFAULT_PLAN);
  const lastTarget = React.useRef(target);
  if (target) lastTarget.current = target;
  const tg = target ?? lastTarget.current;

  React.useEffect(() => {
    if (target) {
      setAgree(false);
      setPlan(DEFAULT_PLAN);
    }
  }, [target]);

  if (!tg) return null;
  const isUnit = tg.kind === "UNIT";
  const amount = isUnit ? tg.unit.price : project.packagePrice;
  const lockedCount = project.documents.filter((d) => d.locked).length;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ purchase: PurchaseItem } | PurchaseItem>("/purchases", {
        projectId: project.id,
        kind: tg.kind,
        ...(isUnit
          ? {
              unitId: tg.unit.id,
              plan: plan.planType === "INSTALLMENT" ? { planType: "INSTALLMENT", downPercent: plan.downPercent, months: plan.months } : { planType: "FULL" },
            }
          : {}),
      });
      const purchase = "purchase" in res ? res.purchase : res;
      toast.success(t("catalog.purchase.success"));
      onClose();
      router.push(`/app/purchases/${purchase.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        toast.info(t("catalog.purchase.loginRequired"));
        router.push(loginHref(isUnit ? "units" : "drawings"));
      } else if (e instanceof ApiError && (e.status === 409 || e.code === "UNIT_UNAVAILABLE")) {
        toast.error(t("catalog.purchase.unavailable"));
        onUnavailable();
        onClose();
      } else {
        toast.error(errorMessage(e, t("common.errors.generic")));
      }
    } finally {
      setBusy(false);
    }
  };

  const steps = [t("catalog.purchase.steps.one"), t("catalog.purchase.steps.two"), t("catalog.purchase.steps.three")];

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size={isUnit && plan.planType === "INSTALLMENT" ? "xl" : isUnit ? "lg" : "md"} className="flex max-h-[94vh] flex-col transition-[max-width] duration-300">
        <DialogHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow">
            {isUnit ? <Home2 size={20} variant="Bold" /> : <DocumentText size={20} variant="Bold" />}
          </div>
          <DialogTitle className="font-display text-2xl font-medium">
            {isUnit ? t("catalog.purchase.unitTitle") : t("catalog.purchase.packageTitle")}
          </DialogTitle>
          <DialogDescription>{isUnit ? t("catalog.purchase.unitDesc") : t("catalog.purchase.packageDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          <div className="rounded-2xl border border-line bg-ink-850 px-4 py-1">
            <InfoRow label={t("catalog.purchase.project")} value={tr(project.name)} />
            {isUnit ? (
              <>
                <InfoRow
                  label={t("catalog.purchase.unit")}
                  value={`№ ${tg.unit.number} · ${t("catalog.units.location", { section: tg.unit.section, floor: tg.unit.floor })}`}
                />
                <InfoRow label={t("catalog.units.type")} value={`${label("unitType", tg.unit.type)} · ${t("catalog.units.roomsN", { n: tg.unit.rooms })}`} />
                <InfoRow label={t("catalog.units.area")} value={fmt.area(tg.unit.area)} mono />
              </>
            ) : (
              <InfoRow label={t("catalog.purchase.includes")} value={t("catalog.purchase.includesDocs", { count: lockedCount })} />
            )}
            <div className="flex items-end justify-between gap-6 py-3">
              <span className="text-sm text-ink-400">{t("catalog.purchase.amount")}</span>
              <span className="font-mono text-xl font-semibold text-gold-gradient">{fmt.money(amount, project.currency)}</span>
            </div>
          </div>

          {isUnit && amount && <PlanPicker amount={Number(amount)} currency={project.currency} value={plan} onChange={setPlan} />}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.purchase.steps.title")}</div>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-3 text-sm text-ink-200"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 font-mono text-[11px] text-gold-200">
                    {i + 1}
                  </span>
                  {s}
                </motion.li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            role="checkbox"
            aria-checked={agree}
            onClick={() => setAgree((a) => !a)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-left text-sm text-ink-200 transition hover:border-line-strong"
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition",
                agree ? "border-gold-400 bg-gold-400 text-onyx" : "border-line-strong",
              )}
            >
              {agree && <TickCircle size={14} variant="Bold" />}
            </span>
            {t("catalog.purchase.agree")}
          </button>
        </DialogBody>
        <DialogFooter className="items-center justify-between">
          <span className="hidden items-center gap-1.5 text-xs text-ink-400 sm:flex">
            <ShieldTick size={15} className="text-success" /> E-IMZO
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="gold" onClick={submit} loading={busy} disabled={!agree}>
              {t("catalog.purchase.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
