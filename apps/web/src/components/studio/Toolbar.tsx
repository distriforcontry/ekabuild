"use client";
import * as React from "react";
import {
  ArrowLeft,
  ArrowRotateLeft,
  ArrowRotateRight,
  Camera,
  CloudAdd,
  DocumentDownload,
  FolderOpen,
  Grid1,
  I3DCubeScan,
  I3DSquare,
  Keyboard,
  LocationAdd,
  Magicpen,
  Maximize,
  Maximize4,
  Maximize3,
  Mouse,
  RotateRight,
  Ruler,
  Scanning,
  Scissor,
  SidebarLeft,
  SidebarRight,
  Size,
  Gallery,
  Data,
  MessageText,
  Box,
  CloseCircle,
  Layer,
  Gps,
  ArrowDown2,
  Grid5,
} from "iconsax-reactjs";
import { motion, AnimatePresence } from "motion/react";
import { formatBytes } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useStudio, useS } from "./context";
import { displayName, fmtInt, fmtM } from "./scene-utils";
import { Divider, IconBtn, Kbd, Segmented, TipLabel, Slider } from "./ui";
import type { ViewName } from "./store";

export interface StudioActions {
  setTool: (t: "select" | "measure" | "area" | "pin") => void;
  setTransform: (m: "translate" | "rotate" | "scale" | null) => void;
  toggleSection: () => void;
  toggle: (k: "xray" | "wireframe" | "grid") => void;
  undo: () => void;
  redo: () => void;
  fit: () => void;
  focusSelection: () => void;
  view: (v: ViewName) => void;
  toggleProjection: () => void;
  screenshot: () => void;
  exportGLB: (selectionOnly?: boolean) => void;
  exportNotes: () => void;
  exportCSV: () => void;
  openFile: () => void;
  openUpload: () => void;
  openHelp: () => void;
  back: () => void;
  toggleFullscreen: () => void;
}

export const ActionsContext = React.createContext<StudioActions | null>(null);
export const useActions = () => React.useContext(ActionsContext)!;

export function Toolbar({
  title,
  subtitle,
  canUpload,
  fullscreen,
}: {
  title: string;
  subtitle?: string | null;
  canUpload: boolean;
  fullscreen: boolean;
}) {
  const { t } = useI18n();
  const { store } = useStudio();
  const a = useActions();
  const loaded = useS((s) => s.loaded);
  const tool = useS((s) => s.tool);
  const transform = useS((s) => s.transform);
  const section = useS((s) => s.section.enabled);
  const xray = useS((s) => s.xray);
  const wire = useS((s) => s.wireframe);
  const grid = useS((s) => s.grid);
  const canUndo = useS((s) => s.canUndo);
  const canRedo = useS((s) => s.canRedo);
  const undoLabel = useS((s) => s.undoLabel);
  const redoLabel = useS((s) => s.redoLabel);
  const dirty = useS((s) => s.dirty);
  const leftOpen = useS((s) => s.leftOpen);
  const rightOpen = useS((s) => s.rightOpen);
  const selection = useS((s) => s.selection);
  const hl = useHistoryLabel();

  return (
    <div className="relative z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-ink-900/90 px-2 backdrop-blur-xl">
      <div className="flex min-w-0 shrink items-center gap-1.5 pr-1 lg:w-[268px]">
        <IconBtn icon={ArrowLeft} label={t("studio.toolbar.back")} onClick={a.back} />
        <IconBtn icon={SidebarLeft} label={t("studio.toolbar.leftPanel")} active={leftOpen} onClick={() => store.set((s) => ({ leftOpen: !s.leftOpen }))} className="hidden md:grid" />
        <div className="min-w-0 pl-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-stone-100" title={title}>
              {title}
            </span>
            {loaded && (
              <Tooltip content={dirty ? t("studio.toolbar.unsaved") : t("studio.toolbar.saved")}>
                <span
                  className={cn("size-2 shrink-0 rounded-full transition-colors", dirty ? "bg-gold-400 shadow-[0_0_0_3px_rgb(201_164_100/0.2)]" : "bg-success/80")}
                  aria-label={dirty ? t("studio.toolbar.unsaved") : t("studio.toolbar.saved")}
                />
              </Tooltip>
            )}
          </div>
          {subtitle && <div className="truncate font-mono text-[10.5px] text-ink-400">{subtitle}</div>}
        </div>
      </div>

      <div role="toolbar" aria-label={t("studio.toolbar.tools")} className="no-scrollbar flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto">
        <IconBtn icon={Mouse} label={t("studio.toolbar.select")} kbd="Q" active={tool === "select" && !transform} disabled={!loaded} onClick={() => a.setTool("select")} />
        <IconBtn icon={Maximize4} label={t("studio.toolbar.move")} kbd="W" active={transform === "translate"} disabled={!loaded} onClick={() => a.setTransform(transform === "translate" ? null : "translate")} />
        <IconBtn icon={RotateRight} label={t("studio.toolbar.rotate")} kbd="E" active={transform === "rotate"} disabled={!loaded} onClick={() => a.setTransform(transform === "rotate" ? null : "rotate")} />
        <IconBtn icon={Size} label={t("studio.toolbar.scale")} kbd="R" active={transform === "scale"} disabled={!loaded} onClick={() => a.setTransform(transform === "scale" ? null : "scale")} />
        <Divider />
        <IconBtn icon={Ruler} label={t("studio.toolbar.measure")} kbd="M" active={tool === "measure"} disabled={!loaded} onClick={() => a.setTool(tool === "measure" ? "select" : "measure")} />
        <IconBtn icon={Grid5} label={t("studio.toolbar.area")} kbd="A" active={tool === "area"} disabled={!loaded} onClick={() => a.setTool(tool === "area" ? "select" : "area")} />
        <IconBtn icon={Scissor} label={t("studio.toolbar.section")} kbd="C" active={section} disabled={!loaded} onClick={a.toggleSection} />
        <IconBtn icon={LocationAdd} label={t("studio.toolbar.pin")} kbd="N" active={tool === "pin"} disabled={!loaded} onClick={() => a.setTool(tool === "pin" ? "select" : "pin")} />
        <Divider />
        <IconBtn icon={Scanning} label={t("studio.toolbar.xray")} kbd="X" active={xray} disabled={!loaded} onClick={() => a.toggle("xray")} />
        <IconBtn icon={I3DSquare} label={t("studio.toolbar.wireframe")} kbd="Z" active={wire} disabled={!loaded} onClick={() => a.toggle("wireframe")} />
        <IconBtn icon={Grid1} label={t("studio.toolbar.grid")} kbd="G" active={grid} disabled={!loaded} onClick={() => a.toggle("grid")} />
        <Divider />
        <IconBtn
          icon={ArrowRotateLeft}
          label={undoLabel ? t("studio.toolbar.undoWhat", { what: hl(undoLabel) }) : t("studio.toolbar.undo")}
          kbd="Ctrl Z"
          disabled={!canUndo}
          onClick={a.undo}
        />
        <IconBtn
          icon={ArrowRotateRight}
          label={redoLabel ? t("studio.toolbar.redoWhat", { what: hl(redoLabel) }) : t("studio.toolbar.redo")}
          kbd="Ctrl ⇧ Z"
          disabled={!canRedo}
          onClick={a.redo}
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        <IconBtn icon={FolderOpen} label={t("studio.toolbar.open")} kbd="Ctrl O" onClick={a.openFile} className="hidden sm:grid" />
        <IconBtn icon={Camera} label={t("studio.toolbar.screenshot")} kbd="P" disabled={!loaded} onClick={a.screenshot} className="hidden sm:grid" />
        <DropdownMenu>
          <Tooltip content={t("studio.toolbar.export")}>
            <DropdownMenuTrigger asChild disabled={!loaded}>
              <button
                type="button"
                aria-label={t("studio.toolbar.export")}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-ink-200 transition hover:bg-fg/6 hover:text-stone-100 disabled:pointer-events-none disabled:opacity-35 data-[state=open]:bg-fg/6"
              >
                <DocumentDownload size={18} />
                <ArrowDown2 size={11} className="text-ink-400" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-64">
            <DropdownMenuLabel>{t("studio.export.title")}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => a.exportGLB(false)}>
              <Box />
              <span className="flex-1">
                {t("studio.export.glb")}
                <span className="block text-[11px] text-ink-400">{t("studio.export.glbHint")}</span>
              </span>
              <Kbd>Ctrl S</Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!selection} onSelect={() => a.exportGLB(true)} className="data-[disabled]:opacity-40">
              <Layer /> {t("studio.export.selection")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={a.exportNotes}>
              <MessageText /> {t("studio.export.json")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={a.exportCSV}>
              <Data /> {t("studio.export.csv")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={a.screenshot}>
              <Gallery /> {t("studio.export.png")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canUpload && (
          <Tooltip content={t("studio.toolbar.upload")}>
            <button
              type="button"
              disabled={!loaded}
              onClick={a.openUpload}
              className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-gold-gradient px-3 text-xs font-bold text-onyx shadow-glow transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              <CloudAdd size={17} variant="Bold" />
              <span className="hidden xl:inline">{t("studio.toolbar.upload")}</span>
            </button>
          </Tooltip>
        )}
        <Divider className="hidden md:block" />
        <IconBtn icon={Keyboard} label={t("studio.toolbar.help")} kbd="?" onClick={a.openHelp} className="hidden md:grid" />
        <IconBtn
          icon={fullscreen ? Maximize3 : Maximize}
          label={fullscreen ? t("studio.toolbar.exitFullscreen") : t("studio.toolbar.fullscreen")}
          active={fullscreen}
          onClick={a.toggleFullscreen}
          className="hidden md:grid"
        />
        <IconBtn icon={SidebarRight} label={t("studio.toolbar.rightPanel")} active={rightOpen} onClick={() => store.set((s) => ({ rightOpen: !s.rightOpen }))} />
      </div>
    </div>
  );
}

export function useHistoryLabel() {
  const { t } = useI18n();
  return React.useCallback(
    (l: string) => {
      const keys = ["visibility", "hide", "show", "showAll", "rename", "delete", "duplicate", "transform", "material", "makeUnique", "upAxis", "preset"] as const;
      return (keys as readonly string[]).includes(l) ? t(`studio.history.${l as (typeof keys)[number]}`) : l;
    },
    [t],
  );
}

// ───────────────────────────── contextual options strip ─────────────────────────────

export function OptionsStrip() {
  const { t } = useI18n();
  const { engine, store } = useStudio();
  const a = useActions();
  const loaded = useS((s) => s.loaded);
  const tool = useS((s) => s.tool);
  const transform = useS((s) => s.transform);
  const space = useS((s) => s.space);
  const snap = useS((s) => s.snap);
  const pickMode = useS((s) => s.pickMode);
  const measures = useS((s) => s.measures.length);
  const section = useS((s) => s.section);
  useS((s) => s.version);
  if (!loaded) return null;
  const sec = (p: Partial<typeof section>) => store.set((s) => ({ section: { ...s.section, ...p } }));
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col items-center gap-2">
      <motion.div
        layout
        className="glass pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl px-2 py-1.5 shadow-card no-scrollbar"
      >
        {tool === "select" && !transform && (
          <>
            <span className="hidden pl-1 text-[11px] font-semibold text-ink-300 sm:inline">{t("studio.toolbar.pickMode")}</span>
            <Segmented
              size="sm"
              className="w-40"
              value={pickMode}
              onChange={(v) => store.set({ pickMode: v })}
              options={[
                { value: "group", label: t("studio.toolbar.pickGroup") },
                { value: "object", label: t("studio.toolbar.pickObject") },
              ]}
            />
            <span className="hidden max-w-[34rem] truncate px-1 text-[11px] text-ink-400 lg:inline">{t("studio.hints.select")}</span>
          </>
        )}
        {transform && (
          <>
            <Segmented
              size="sm"
              className="w-56"
              value={transform}
              onChange={(v) => a.setTransform(v)}
              options={[
                { value: "translate", label: <span className="flex items-center gap-1">{t("studio.toolbar.move")} <span className="font-mono text-[9px] opacity-60">W</span></span> },
                { value: "rotate", label: <span className="flex items-center gap-1">{t("studio.toolbar.rotate")} <span className="font-mono text-[9px] opacity-60">E</span></span> },
                { value: "scale", label: <span className="flex items-center gap-1">{t("studio.toolbar.scale")} <span className="font-mono text-[9px] opacity-60">R</span></span> },
              ]}
            />
            <Segmented
              size="sm"
              className="w-32"
              value={space}
              onChange={(v) => store.set({ space: v })}
              options={[
                { value: "world", label: t("studio.toolbar.world") },
                { value: "local", label: t("studio.toolbar.local") },
              ]}
            />
            <button
              type="button"
              aria-pressed={snap}
              onClick={() => store.set({ snap: !snap })}
              className={cn(
                "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition",
                snap ? "border-gold-500/50 bg-gold-500/12 text-gold-200" : "border-line text-ink-300 hover:text-stone-100",
              )}
            >
              <Magicpen size={13} /> {t("studio.toolbar.snap")}
            </button>
            {!engine.get(store.get().selection) && <span className="px-1 text-[11px] text-warning">{t("studio.toast.nothingSelected")}</span>}
          </>
        )}
        {tool === "measure" && (
          <>
            <Ruler size={15} className="ml-1 shrink-0 text-gold-300" />
            <span className="truncate px-1 text-[11px] text-ink-200">{t("studio.hints.measureStart")}</span>
            {measures > 0 && (
              <button type="button" onClick={() => store.set({ measures: [] })} className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-300 hover:bg-fg/6 hover:text-stone-100">
                {t("studio.toolbar.clear")} ({measures})
              </button>
            )}
          </>
        )}
        {tool === "area" && (
          <>
            <Grid5 size={15} className="ml-1 shrink-0 text-gold-300" />
            <span className="truncate px-1 text-[11px] text-ink-200">{t("studio.hints.area")}</span>
          </>
        )}
        {tool === "pin" && (
          <>
            <LocationAdd size={15} className="ml-1 shrink-0 text-gold-300" />
            <span className="truncate px-1 text-[11px] text-ink-200">{t("studio.hints.pin")}</span>
          </>
        )}
      </motion.div>
      <AnimatePresence>
        {section.enabled && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl px-3 py-1.5 shadow-card"
          >
            <Scissor size={15} className="shrink-0 text-gold-300" />
            <Segmented
              size="sm"
              className="w-28 shrink-0"
              value={section.axis}
              onChange={(v) => sec({ axis: v })}
              options={[
                { value: "x", label: <span className="font-mono text-danger">X</span> },
                { value: "y", label: <span className="font-mono text-success">Y</span> },
                { value: "z", label: <span className="font-mono text-info">Z</span> },
              ]}
            />
            <div className="min-w-0 flex-1">
              <Slider label={null} value={section.offset} min={0} max={1} step={0.002} format={() => fmtM(engine.sectionPosition(), 2)} onChange={(v) => sec({ offset: v })} />
            </div>
            <IconBtn size="sm" icon={ArrowRotateRight} label={t("studio.view.flip")} active={section.flip} onClick={() => sec({ flip: !section.flip })} />
            <IconBtn size="sm" icon={CloseCircle} label={t("studio.toolbar.section")} onClick={() => sec({ enabled: false })} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────── view bar (bottom-left) ─────────────────────────────

export function ViewBar() {
  const { t } = useI18n();
  const a = useActions();
  const loaded = useS((s) => s.loaded);
  const projection = useS((s) => s.projection);
  if (!loaded) return null;
  const views: { v: ViewName; k: string; label: string }[] = [
    { v: "front", k: "1", label: t("studio.views.front") },
    { v: "top", k: "2", label: t("studio.views.top") },
    { v: "right", k: "3", label: t("studio.views.right") },
    { v: "iso", k: "4", label: t("studio.views.iso") },
  ];
  return (
    <div className="glass absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-2xl p-1 shadow-card">
      {views.map((x) => (
        <Tooltip key={x.v} content={<TipLabel label={x.label} kbd={x.k} />} side="top">
          <button
            type="button"
            onClick={() => a.view(x.v)}
            className="h-8 cursor-pointer rounded-lg px-2.5 text-[11px] font-semibold text-ink-200 transition hover:bg-fg/8 hover:text-stone-100 active:scale-95"
          >
            {x.label}
          </button>
        </Tooltip>
      ))}
      <Divider />
      <Tooltip content={<TipLabel label={t("studio.toolbar.projection")} kbd="5" />} side="top">
        <button
          type="button"
          onClick={a.toggleProjection}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-ink-200 transition hover:bg-fg/8 hover:text-stone-100"
        >
          <I3DCubeScan size={15} className="text-gold-300" />
          <span className="hidden sm:inline">{projection === "perspective" ? t("studio.toolbar.perspective") : t("studio.toolbar.orthographic")}</span>
        </button>
      </Tooltip>
      <IconBtn size="sm" side="top" icon={Maximize4} label={t("studio.toolbar.fit")} kbd="⇧ F" onClick={a.fit} className="size-8" />
      <IconBtn size="sm" side="top" icon={Gps} label={t("studio.toolbar.focus")} kbd="F" onClick={a.focusSelection} className="size-8" />
    </div>
  );
}

// ───────────────────────────── status bar ─────────────────────────────

export function StatusBar() {
  const { t } = useI18n();
  const { engine } = useStudio();
  const loaded = useS((s) => s.loaded);
  const tool = useS((s) => s.tool);
  const transform = useS((s) => s.transform);
  const selection = useS((s) => s.selection);
  const isolated = useS((s) => s.isolated);
  const section = useS((s) => s.section.enabled);
  const explode = useS((s) => s.explode);
  const projection = useS((s) => s.projection);
  useS((s) => s.version);
  const st = loaded ? engine.stats() : null;
  const sel = engine.get(selection);
  const hint = !loaded
    ? ""
    : transform
      ? t("studio.hints.transform")
      : tool === "measure"
        ? t("studio.hints.measureStart")
        : tool === "area"
          ? t("studio.hints.area")
          : tool === "pin"
            ? t("studio.hints.pin")
            : t("studio.hints.orbit");
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line bg-ink-900/90 px-3 font-mono text-[10.5px] text-ink-400">
      <span className="hidden min-w-0 flex-1 truncate font-sans md:block">{hint}</span>
      <span className="min-w-0 flex-1 truncate md:flex-none md:max-w-[30%]">
        {sel ? (
          <>
            <span className="text-ink-300">{t("studio.status.selected")}:</span> <span className="text-gold-200">{displayName(sel) || sel.type}</span>
          </>
        ) : loaded ? (
          t("studio.status.nothing")
        ) : null}
      </span>
      {isolated && <span className="rounded bg-gold-500/12 px-1.5 text-gold-200">{t("studio.status.isolated")}</span>}
      {section && <span className="rounded bg-gold-500/12 px-1.5 text-gold-200">{t("studio.status.section")}</span>}
      {explode > 0 && <span className="rounded bg-gold-500/12 px-1.5 text-gold-200">{t("studio.status.exploded")}</span>}
      {st && <span>{t("studio.status.triangles", { n: fmtInt(st.triangles) })}</span>}
      {engine.info && <span className="hidden sm:inline">{formatBytes(engine.info.fileSize)}</span>}
      {loaded && <span className="hidden sm:inline">{projection === "perspective" ? t("studio.toolbar.perspective") : t("studio.toolbar.orthographic")}</span>}
    </div>
  );
}
