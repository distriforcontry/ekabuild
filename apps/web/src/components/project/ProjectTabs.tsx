"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import {
  Activity,
  Book1,
  DocumentText,
  Grid5,
  I3DCubeScan,
  Map1,
  RulerPen,
  SearchStatus,
} from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useProject, type TabKey } from "./ProjectProvider";
import { OverviewTab } from "./tabs/OverviewTab";
import { ModelTab } from "./tabs/ModelTab";
import { DrawingsTab, DRAWING_TYPES } from "./tabs/DrawingsTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { CadastreTab } from "./tabs/CadastreTab";
import { ProgressTab } from "./tabs/ProgressTab";
import { InspectionsTab } from "./tabs/InspectionsTab";
import { UnitsTab } from "./tabs/UnitsTab";

const TABS: { key: TabKey; icon: Icon; render: () => React.ReactNode }[] = [
  { key: "overview", icon: Book1, render: () => <OverviewTab /> },
  { key: "model", icon: I3DCubeScan, render: () => <ModelTab /> },
  { key: "drawings", icon: RulerPen, render: () => <DrawingsTab /> },
  { key: "documents", icon: DocumentText, render: () => <DocumentsTab /> },
  { key: "cadastre", icon: Map1, render: () => <CadastreTab /> },
  { key: "progress", icon: Activity, render: () => <ProgressTab /> },
  { key: "inspections", icon: SearchStatus, render: () => <InspectionsTab /> },
  { key: "units", icon: Grid5, render: () => <UnitsTab /> },
];

/** Radix tabs synced with the URL hash; animated active pill + content fade. */
export function ProjectTabs() {
  const { t } = useI18n();
  const { project: p, tab, setTab } = useProject();

  const counts: Partial<Record<TabKey, number>> = {
    drawings: (p.documents ?? []).filter((d) => DRAWING_TYPES.includes(d.type)).length,
    documents: (p.documents ?? []).filter((d) => !DRAWING_TYPES.includes(d.type)).length + (p.certificates ?? []).length,
    progress: (p.progressUpdates ?? []).length,
    inspections: (p.inspections ?? []).length,
    units: p.unitsSummary?.AVAILABLE ?? p.unitsAvailable,
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} id="project-tabs" className="scroll-mt-24">
      <div className="relative -mx-4 sm:mx-0">
        <TabsList
          aria-label={t("catalog.tabs.label")}
          className="no-scrollbar flex w-full justify-start gap-1 rounded-none border-x-0 bg-ink-900/80 px-4 py-1.5 backdrop-blur sm:rounded-2xl sm:border-x sm:px-1.5"
        >
          {TABS.map(({ key, icon: I }) => {
            const active = key === tab;
            const count = counts[key];
            return (
              <TabsPrimitive.Trigger
                key={key}
                value={key}
                className={cn(
                  "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-colors duration-300",
                  active ? "text-stone-100" : "text-ink-300 hover:text-stone-100",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="project-tab-pill"
                    className="absolute inset-0 rounded-xl border border-gold-500/25 bg-ink-700 shadow-card"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <I size={17} variant={active ? "Bold" : "Linear"} className={cn("relative", active && "text-gold-300")} />
                <span className="relative">{t(`catalog.tabs.${key}`)}</span>
                {typeof count === "number" && count > 0 && (
                  <span
                    className={cn(
                      "relative rounded-full px-1.5 py-px font-mono text-[10px]",
                      active ? "bg-gold-500/15 text-gold-200" : "bg-fg/6 text-ink-300",
                    )}
                  >
                    {count}
                  </span>
                )}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsList>
      </div>

      {TABS.map(({ key, render }) => (
        <TabsPrimitive.Content key={key} value={key} className="mt-6 focus-visible:outline-none md:mt-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {render()}
          </motion.div>
        </TabsPrimitive.Content>
      ))}
    </Tabs>
  );
}
