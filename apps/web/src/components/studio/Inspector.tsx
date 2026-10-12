"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Brush, Buildings, Data, MessageText, Setting4, Sun1 } from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { useStudio, useS } from "./context";
import type { InspectorTab } from "./store";
import { FloorsPanel, MaterialPanel, NotesPanel, PropertiesPanel, ScenePanel, ViewPanel } from "./panels";

const TABS: { id: InspectorTab; icon: Icon }[] = [
  { id: "props", icon: Setting4 },
  { id: "material", icon: Brush },
  { id: "floors", icon: Buildings },
  { id: "scene", icon: Data },
  { id: "notes", icon: MessageText },
  { id: "view", icon: Sun1 },
];

export function Inspector() {
  const { store } = useStudio();
  const { t } = useI18n();
  const tab = useS((s) => s.tab);
  const counts = {
    notes: useS((s) => s.pins.length + s.measures.length + s.areas.length),
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={t("studio.toolbar.rightPanel")} className="flex h-11 shrink-0 items-stretch gap-0.5 border-b border-line px-1.5">
        {TABS.map(({ id, icon: I }) => {
          const active = tab === id;
          const badge = id === "notes" && counts.notes > 0 ? counts.notes : null;
          return (
            <Tooltip key={id} content={t(`studio.tabs.${id}`)} side="bottom">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={t(`studio.tabs.${id}`)}
                onClick={() => store.set({ tab: id })}
                className={cn(
                  "relative flex flex-1 cursor-pointer items-center justify-center transition-colors",
                  active ? "text-gold-200" : "text-ink-400 hover:text-stone-100",
                )}
              >
                <I size={18} variant={active ? "Bold" : "Linear"} />
                {badge && (
                  <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-gold-gradient px-1 font-mono text-[9px] font-bold leading-[14px] text-onyx">
                    {badge}
                  </span>
                )}
                {active && <motion.span layoutId="studio-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold-400" />}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex h-9 shrink-0 items-center border-b border-line px-4">
        <span className="text-[13px] font-semibold text-stone-100">{t(`studio.tabs.${tab}`)}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === "props" && <PropertiesPanel />}
            {tab === "material" && <MaterialPanel />}
            {tab === "floors" && <FloorsPanel />}
            {tab === "scene" && <ScenePanel />}
            {tab === "notes" && <NotesPanel />}
            {tab === "view" && <ViewPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
