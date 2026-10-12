"use client";
// 3D Studio shell: loads a model (project / URL / local files), lays out toolbar + outliner + viewport +
// inspector, wires keyboard shortcuts, drag & drop, export and upload. Loaded client-only (ssr:false).
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { DocumentUpload, FolderOpen, I3DCubeScan, Warning2, CloseCircle, Refresh2 } from "iconsax-reactjs";
import { toast } from "sonner";
import { formatBytes } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StudioContext } from "./context";
import { Engine } from "./engine";
import { ACCEPT, LoadError, MODEL_EXT, loadModel, type LoadProgress, type ModelSource } from "./loaders";
import { Store, initialState, useStoreValue, type StudioState } from "./store";
import { disposeObject, displayName, downloadBlob, fmtInt, slugify, worldBox } from "./scene-utils";
import Viewport, { type ViewportLabels } from "./Viewport";
import { Outliner } from "./Outliner";
import { Inspector } from "./Inspector";
import { ActionsContext, OptionsStrip, StatusBar, Toolbar, ViewBar, useHistoryLabel, type StudioActions } from "./Toolbar";
import { ConfirmDialog, HelpDialog, UploadDialog, type ConfirmRequest, type StudioProject } from "./Dialogs";
import { downloadNotesJson, downloadStatsCsv, stamp } from "./exporters";

export interface StudioAppProps {
  source: ModelSource | null;
  project?: StudioProject | null;
  isDeveloper?: boolean;
  /** shown when hosted by the gallery (local files); otherwise navigates to /app/studio */
  onBack?: () => void;
}

const LAYOUT_KEY = "eka.studio.layout.v1";

function useMedia(q: string) {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function keyOf(src: ModelSource, project: StudioProject | null | undefined) {
  if (src.kind === "url") return project ? `project:${project.id}:${src.url}` : `url:${src.url}`;
  const f = src.files.find((x) => MODEL_EXT.test(x.name)) ?? src.files[0];
  return `file:${f?.name}:${f?.size}`;
}

export default function StudioApp({ source: initialSource, project: initialProject = null, isDeveloper = false, onBack }: StudioAppProps) {
  const { t, tr } = useI18n();
  const router = useRouter();
  const store = React.useMemo(() => new Store<StudioState>(initialState()), []);
  const engine = React.useMemo(() => new Engine(store), [store]);
  const ctx = React.useMemo(() => ({ engine, store }), [engine, store]);
  const hl = useHistoryLabel();

  const [source, setSource] = React.useState<ModelSource | null>(initialSource);
  const [project, setProject] = React.useState<StudioProject | null>(initialProject);
  const [status, setStatus] = React.useState<"empty" | "loading" | "ready" | "error">(initialSource ? "loading" : "empty");
  const [progress, setProgress] = React.useState<LoadProgress>({ phase: "download", loaded: 0, total: 0 });
  const [error, setError] = React.useState<LoadError | null>(null);
  const [webgl, setWebgl] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(false);
  const [confirmReq, setConfirmReq] = React.useState<ConfirmRequest | null>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [height, setHeight] = React.useState<string>("calc(100dvh - 8rem)");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const compact = useMedia("(max-width: 1023px)");

  const leftOpen = useStoreValue(store, (s) => s.leftOpen);
  const rightOpen = useStoreValue(store, (s) => s.rightOpen);
  const leftWidth = useStoreValue(store, (s) => s.leftWidth);
  const rightWidth = useStoreValue(store, (s) => s.rightWidth);
  const loaded = useStoreValue(store, (s) => s.loaded);
  const dirty = useStoreValue(store, (s) => s.dirty);
  const [resizing, setResizing] = React.useState(false);

  React.useEffect(() => setWebgl(hasWebGL()), []);
  React.useEffect(() => () => engine.dispose(), [engine]);

  // ── fill the viewport under the cabinet top bar ──
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const calc = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const main = el.closest("main");
      const pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 24;
      setHeight(`max(560px, calc(100dvh - ${Math.round(top + pb)}px))`);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  React.useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // ── layout persistence (per viewer) ──
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<StudioState>;
        store.set({
          leftOpen: d.leftOpen ?? true,
          rightOpen: d.rightOpen ?? true,
          leftWidth: Math.min(480, Math.max(220, d.leftWidth ?? 280)),
          rightWidth: Math.min(520, Math.max(280, d.rightWidth ?? 340)),
        });
      }
    } catch {
      /* ignore */
    }
  }, [store]);
  React.useEffect(() => {
    if (compact) store.set({ leftOpen: false, rightOpen: false });
  }, [compact, store]);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let prev = store.get();
    return store.subscribe(() => {
      const s = store.get();
      if (s.leftOpen !== prev.leftOpen || s.rightOpen !== prev.rightOpen || s.leftWidth !== prev.leftWidth || s.rightWidth !== prev.rightWidth) {
        if (!window.matchMedia("(max-width: 1023px)").matches) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              localStorage.setItem(LAYOUT_KEY, JSON.stringify({ leftOpen: s.leftOpen, rightOpen: s.rightOpen, leftWidth: s.leftWidth, rightWidth: s.rightWidth }));
            } catch {
              /* ignore */
            }
          }, 300);
        }
      }
      // notes → localStorage (per model)
      if (s.measures !== prev.measures || s.areas !== prev.areas || s.pins !== prev.pins) {
        if (s.loaded) engine.writeNotes();
        engine.invalidate();
      }
      prev = s;
    });
  }, [store, engine]);

  // ── loading ──
  React.useEffect(() => {
    abortRef.current?.abort();
    if (!source) {
      engine.unload();
      store.set({ loaded: false, selection: null, hover: null });
      setStatus("empty");
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    engine.unload();
    store.set({ loaded: false, selection: null, hover: null, tool: "select", transform: null });
    setStatus("loading");
    setError(null);
    setProgress({ phase: "download", loaded: 0, total: source.kind === "url" ? (source.size ?? 0) : 0 });
    const t0 = performance.now();
    loadModel(source, setProgress, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) {
          res.cleanup();
          disposeObject(res.root);
          return;
        }
        engine.load(res, keyOf(source, project));
        setStatus("ready");
        toast.success(t("studio.toast.opened", { name: res.name, time: `${fmtInt(performance.now() - t0)} ms` }), {
          description: `${formatBytes(res.fileSize)} · ${t("studio.status.triangles", { n: fmtInt(engine.stats()?.triangles ?? 0) })}`,
        });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        const err = e instanceof LoadError ? e : new LoadError("PARSE", errorMessage(e));
        if (err.code === "ABORT") return;
        setError(err);
        setStatus("error");
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, engine, store]);

  // ── unsaved changes guard ──
  React.useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);

  const confirm = React.useCallback(
    (title: string, text: string, label: string) => new Promise<boolean>((resolve) => setConfirmReq({ title, text, confirm: label, resolve })),
    [],
  );

  const openFiles = React.useCallback(
    async (list: FileList | File[] | null) => {
      const files = list ? Array.from(list) : [];
      if (!files.length) return;
      if (!files.some((f) => MODEL_EXT.test(f.name))) {
        toast.error(t("studio.home.open.badType"), { description: t("studio.home.open.formats") });
        return;
      }
      if (store.get().dirty && !(await confirm(t("studio.confirm.replaceTitle"), t("studio.confirm.replaceText"), t("studio.confirm.replace")))) return;
      setSource({ kind: "files", files });
    },
    [store, confirm, t],
  );

  const baseName = React.useMemo(() => {
    const n = project ? project.slug || project.name : engine.info?.name ?? "model";
    return `${slugify(n)}-studio`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, loaded]);

  // ── actions (toolbar + keyboard) ──
  const actions = React.useMemo<StudioActions>(() => {
    const a: StudioActions = {
      setTool: (tool) => store.set({ tool, transform: null }),
      setTransform: (m) => store.set({ transform: m, tool: "select" }),
      toggleSection: () => store.set((s) => ({ section: { ...s.section, enabled: !s.section.enabled } })),
      toggle: (k) => store.set((s) => ({ [k]: !s[k] }) as Partial<StudioState>),
      undo: () => {
        const c = engine.undo();
        if (c) toast(t("studio.toast.undone", { what: hl(c.label) }), { duration: 1400 });
      },
      redo: () => {
        const c = engine.redo();
        if (c) toast(t("studio.toast.redone", { what: hl(c.label) }), { duration: 1400 });
      },
      fit: () => engine.cam?.fit(engine.bounds.box),
      focusSelection: () => {
        const o = engine.get(store.get().selection);
        engine.cam?.fit(o ? worldBox(o, true, engine.root) : engine.bounds.frame);
      },
      view: (v) => engine.cam?.view(v),
      toggleProjection: () => store.set((s) => ({ projection: s.projection === "perspective" ? "orthographic" : "perspective" })),
      screenshot: async () => {
        const s = store.get();
        if (!s.loaded) return;
        const blob = await engine.cam?.screenshot({ measures: s.measures, areas: s.areas, pins: s.pins });
        if (!blob) return;
        downloadBlob(blob, `${baseName}-${stamp()}.png`);
        toast.success(t("studio.toast.screenshot"), { description: formatBytes(blob.size) });
      },
      exportGLB: async (selectionOnly) => {
        const s = store.get();
        if (!s.loaded) return;
        const sel = selectionOnly ? engine.get(s.selection) : null;
        if (selectionOnly && !sel) return;
        const id = toast.loading(t("studio.export.working"));
        try {
          const blob = await engine.exportGLB({ onlyVisible: false, selection: sel?.uuid ?? null });
          downloadBlob(blob, sel ? `${baseName}-${slugify(displayName(sel) || "object")}.glb` : `${baseName}.glb`);
          if (!sel) engine.markSaved();
          toast.success(t("studio.export.done"), { id, description: formatBytes(blob.size) });
        } catch (e) {
          toast.error(t("studio.export.failed"), { id, description: errorMessage(e) });
        }
      },
      exportNotes: () => downloadNotesJson(engine),
      exportCSV: () => downloadStatsCsv(engine, t),
      openFile: () => fileRef.current?.click(),
      openUpload: () => store.get().loaded && store.set({ uploadOpen: true }),
      openHelp: () => store.set({ helpOpen: true }),
      back: async () => {
        if (store.get().dirty && !(await confirm(t("studio.confirm.leaveTitle"), t("studio.confirm.leaveText"), t("studio.confirm.leave")))) return;
        engine.markSaved();
        if (document.fullscreenElement) void document.exitFullscreen?.();
        if (onBack) onBack();
        else router.push("/app/studio");
      },
      toggleFullscreen: () => {
        const el = rootRef.current;
        if (!el) return;
        if (document.fullscreenElement) void document.exitFullscreen?.();
        else void el.requestFullscreen?.().catch(() => {});
      },
    };
    return a;
  }, [engine, store, t, hl, baseName, confirm, onBack, router]);

  // ── keyboard shortcuts ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"],[role="menu"]')) return;
      const s = store.get();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod) {
        if (k === "z") e.shiftKey ? actions.redo() : actions.undo();
        else if (k === "y") actions.redo();
        else if (k === "s") void actions.exportGLB(false);
        else if (k === "o") actions.openFile();
        else if (k === "d" && s.selection) engine.duplicate(s.selection);
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      if (e.key === "?") {
        actions.openHelp();
        e.preventDefault();
        return;
      }
      if (!s.loaded) return;
      switch (k) {
        case "q":
          actions.setTool("select");
          break;
        case "w":
          actions.setTransform("translate");
          break;
        case "e":
          actions.setTransform("rotate");
          break;
        case "r":
          actions.setTransform("scale");
          break;
        case "m":
          actions.setTool(s.tool === "measure" ? "select" : "measure");
          break;
        case "a":
          actions.setTool(s.tool === "area" ? "select" : "area");
          break;
        case "n":
          actions.setTool(s.tool === "pin" ? "select" : "pin");
          break;
        case "c":
          actions.toggleSection();
          break;
        case "x":
          actions.toggle("xray");
          break;
        case "z":
          actions.toggle("wireframe");
          break;
        case "g":
          actions.toggle("grid");
          break;
        case "f":
          if (e.shiftKey) actions.fit();
          else actions.focusSelection();
          break;
        case "h":
          if (e.shiftKey) engine.showAll();
          else if (s.selection) engine.toggleVisible(s.selection);
          break;
        case "i":
          if (s.selection) engine.isolate(s.selection);
          else if (s.isolated) engine.isolate(null);
          break;
        case "l":
          if (s.selection) engine.toggleLock(s.selection);
          break;
        case "p":
          void actions.screenshot();
          break;
        case "t":
          store.set((st) => {
            const open = !(st.leftOpen || st.rightOpen);
            return { leftOpen: open, rightOpen: open };
          });
          break;
        case "1":
          actions.view("front");
          break;
        case "2":
          actions.view("top");
          break;
        case "3":
          actions.view("right");
          break;
        case "4":
          actions.view("iso");
          break;
        case "5":
          actions.toggleProjection();
          break;
        case "delete":
        case "backspace":
          if (s.selection) {
            const o = engine.get(s.selection);
            engine.remove(s.selection);
            if (o) toast(t("studio.toast.deleted", { name: displayName(o) }), { action: { label: t("studio.toolbar.undo"), onClick: () => actions.undo() } });
          }
          break;
        case "escape":
          store.set((st) => ({ esc: st.esc + 1 }));
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, engine, store, t]);

  // ── panel resizing ──
  const startResize = (side: "left" | "right") => (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = side === "left" ? store.get().leftWidth : store.get().rightWidth;
    setResizing(true);
    const move = (ev: PointerEvent) => {
      const d = ev.clientX - startX;
      const w = side === "left" ? Math.min(480, Math.max(220, start + d)) : Math.min(520, Math.max(280, start - d));
      store.set(side === "left" ? { leftWidth: w } : { rightWidth: w });
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const labels = React.useMemo<ViewportLabels>(
    () => ({
      faces: [t("studio.cube.right"), t("studio.cube.left"), t("studio.cube.top"), t("studio.cube.bottom"), t("studio.cube.front"), t("studio.cube.back")],
      pin: (n) => t("studio.notes.pin", { n }),
      untitledPin: t("studio.notes.untitled"),
      noWebgl: t("studio.errors.webgl"),
    }),
    [t],
  );

  const title = project ? tr(project.name) : (engine.info?.name ?? (source?.kind === "files" ? source.files[0]?.name : null) ?? t("studio.meta.title"));
  const subtitle = loaded && engine.info ? `${engine.info.name} · ${formatBytes(engine.info.fileSize)}` : null;
  const canUpload = isDeveloper || Boolean(project?.isOwner);

  const panelTransition = resizing ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <StudioContext.Provider value={ctx}>
      <ActionsContext.Provider value={actions}>
        <div
          ref={rootRef}
          style={{ height: fullscreen ? "100dvh" : height }}
          className={cn(
            "relative isolate flex flex-col overflow-hidden border border-line bg-ink-900 text-ink-100 shadow-card",
            fullscreen ? "rounded-none" : "rounded-2xl",
          )}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void openFiles(e.dataTransfer.files);
          }}
        >
          <Toolbar title={title} subtitle={subtitle} canUpload={canUpload} fullscreen={fullscreen} />
          <div className="relative flex min-h-0 flex-1">
            {/* left: outliner */}
            <motion.aside
              initial={false}
              animate={{ width: leftOpen && loaded ? leftWidth : 0, opacity: leftOpen && loaded ? 1 : 0 }}
              transition={panelTransition}
              className={cn(
                "relative z-20 shrink-0 overflow-hidden border-line bg-ink-900",
                leftOpen && loaded && "border-r",
                compact && "absolute inset-y-0 left-0 shadow-lift",
              )}
              aria-label={t("studio.toolbar.leftPanel")}
            >
              <div style={{ width: leftWidth }} className="h-full">
                <Outliner />
              </div>
              {!compact && leftOpen && loaded && (
                <div
                  onPointerDown={startResize("left")}
                  className="group/rz absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize"
                  role="separator"
                  aria-orientation="vertical"
                >
                  <span className="absolute inset-y-0 right-0 w-px bg-transparent transition group-hover/rz:bg-gold-500/60" />
                </div>
              )}
            </motion.aside>

            {/* center: viewport */}
            <div
              className="relative min-w-0 flex-1 overflow-hidden"
              style={{ background: "radial-gradient(130% 100% at 50% 0%, var(--color-ink-850) 0%, var(--color-ink-950) 78%)" }}
            >
              {webgl ? <Viewport labels={labels} className="!absolute inset-0" /> : null}
              <OptionsStrip />
              <ViewBar />

              <AnimatePresence>
                {status === "loading" && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 grid place-items-center bg-ink-950/40 backdrop-blur-[2px]"
                  >
                    <LoadingCard progress={progress} onCancel={() => setSource(null)} />
                  </motion.div>
                )}
              </AnimatePresence>

              {!webgl && (
                <Overlay>
                  <StateCard icon={Warning2} tone="danger" title={t("studio.errors.webgl")} text={t("studio.errors.webglHint")} />
                </Overlay>
              )}
              {webgl && status === "empty" && (
                <Overlay>
                  <EmptyDrop project={project} onOpen={() => fileRef.current?.click()} />
                </Overlay>
              )}
              {webgl && status === "error" && error && (
                <Overlay>
                  <StateCard
                    icon={Warning2}
                    tone="danger"
                    title={t("studio.errors.title")}
                    text={errorText(error, t)}
                    actions={
                      <>
                        {source?.kind === "url" && (
                          <Button variant="secondary" size="sm" onClick={() => setSource({ ...source })}>
                            <Refresh2 size={15} /> {t("studio.errors.retry")}
                          </Button>
                        )}
                        <Button variant="gold" size="sm" onClick={() => fileRef.current?.click()}>
                          <FolderOpen size={15} /> {t("studio.errors.openOther")}
                        </Button>
                      </>
                    }
                  />
                </Overlay>
              )}

              <AnimatePresence>
                {dragOver && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-gold-400/70 bg-gold-500/8 backdrop-blur-sm"
                  >
                    <div className="text-center">
                      <DocumentUpload size={40} variant="Bulk" className="mx-auto text-gold-300" />
                      <div className="mt-3 text-base font-semibold text-stone-100">{t("studio.drop.title")}</div>
                      <div className="mt-1 font-mono text-xs text-ink-300">{t("studio.drop.hint")}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* right: inspector */}
            <motion.aside
              initial={false}
              animate={{ width: rightOpen && loaded ? rightWidth : 0, opacity: rightOpen && loaded ? 1 : 0 }}
              transition={panelTransition}
              className={cn(
                "relative z-20 shrink-0 overflow-hidden border-line bg-ink-900",
                rightOpen && loaded && "border-l",
                compact && "absolute inset-y-0 right-0 shadow-lift",
              )}
              aria-label={t("studio.toolbar.rightPanel")}
            >
              {!compact && rightOpen && loaded && (
                <div
                  onPointerDown={startResize("right")}
                  className="group/rz absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize"
                  role="separator"
                  aria-orientation="vertical"
                >
                  <span className="absolute inset-y-0 left-0 w-px bg-transparent transition group-hover/rz:bg-gold-500/60" />
                </div>
              )}
              <div style={{ width: rightWidth }} className="h-full">
                <Inspector />
              </div>
            </motion.aside>
          </div>
          <StatusBar />

          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              void openFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <HelpDialog />
          <UploadDialog
            project={project}
            isDeveloper={isDeveloper}
            filenameBase={baseName}
            onUploaded={(p, file) => {
              setProject((cur) => ({ id: p.id, slug: p.slug, name: p.name || cur?.name || "", isOwner: true }));
              void file;
            }}
          />
          <ConfirmDialog req={confirmReq} onClose={() => setConfirmReq(null)} />
        </div>
      </ActionsContext.Provider>
    </StudioContext.Provider>
  );
}

function errorText(e: LoadError, t: ReturnType<typeof useI18n>["t"]) {
  switch (e.code) {
    case "HTTP":
      return t("studio.errors.HTTP", { status: e.status ?? "?" });
    case "NETWORK":
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "FORMAT":
    case "DRACO":
    case "KTX2":
    case "EMPTY":
    case "ABORT":
      return t(`studio.errors.${e.code}`);
    default:
      return `${t("studio.errors.PARSE")}${e.message ? ` (${e.message.slice(0, 140)})` : ""}`;
  }
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-20 grid place-items-center p-6">
      {children}
    </motion.div>
  );
}

function StateCard({
  icon: I,
  title,
  text,
  actions,
  tone = "gold",
}: {
  icon: typeof Warning2;
  title: string;
  text: string;
  actions?: React.ReactNode;
  tone?: "gold" | "danger";
}) {
  return (
    <div className="glass w-full max-w-md rounded-3xl p-7 text-center shadow-lift">
      <div
        className={cn(
          "mx-auto mb-4 grid size-14 place-items-center rounded-2xl border",
          tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : "border-gold-500/25 bg-gold-500/8 text-gold-300",
        )}
      >
        <I size={26} variant="Bulk" />
      </div>
      <h3 className="text-lg font-semibold text-stone-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">{text}</p>
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

function EmptyDrop({ project, onOpen }: { project: StudioProject | null; onOpen: () => void }) {
  const { t, tr } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/drop flex w-full max-w-lg cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-line-strong bg-ink-900/60 px-8 py-12 text-center backdrop-blur transition hover:border-gold-500/60 hover:bg-gold-500/4"
    >
      <span className="relative mb-5 grid size-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-300 transition group-hover/drop:scale-105">
        <I3DCubeScan size={30} variant="Bulk" className="animate-float" />
      </span>
      <span className="text-lg font-semibold text-stone-100">{t("studio.empty.title")}</span>
      <span className="mt-2 max-w-sm text-sm leading-relaxed text-ink-300">
        {project ? t("studio.empty.project", { name: tr(project.name) }) : t("studio.empty.hint")}
      </span>
      <span className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-gold-gradient px-5 text-sm font-semibold text-onyx shadow-glow">
        <FolderOpen size={17} /> {t("studio.empty.button")}
      </span>
      <span className="mt-4 font-mono text-[11px] text-ink-400">{t("studio.home.open.formats")}</span>
    </button>
  );
}

function LoadingCard({ progress, onCancel }: { progress: LoadProgress; onCancel: () => void }) {
  const { t } = useI18n();
  const pct = progress.phase === "download" ? (progress.total ? Math.min(100, (progress.loaded / progress.total) * 100) : 0) : 100;
  const c = 2 * Math.PI * 26;
  const steps = ["download", "parse", "prepare"] as const;
  const idx = steps.indexOf(progress.phase);
  return (
    <div className="glass w-[320px] rounded-3xl p-6 shadow-lift" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0">
          <svg width="64" height="64" className="-rotate-90">
            <circle cx="32" cy="32" r="26" stroke="var(--color-line-strong)" strokeWidth="4" fill="none" />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="var(--color-gold-400)"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={progress.phase === "download" && !progress.total ? c * 0.75 : c - (c * pct) / 100}
              className={cn(progress.phase === "download" && !progress.total && "origin-center animate-spin")}
              style={{ transition: "stroke-dashoffset .25s" }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-xs font-bold text-stone-100">
            {progress.phase === "download" && progress.total ? `${Math.round(pct)}%` : <I3DCubeScan size={20} className="text-gold-300" />}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-stone-100">{t(`studio.load.${progress.phase}`)}…</div>
          {progress.phase === "download" && (
            <div className="mt-0.5 font-mono text-[11px] text-ink-300">
              {progress.total ? t("studio.load.of", { loaded: formatBytes(progress.loaded), total: formatBytes(progress.total) }) : formatBytes(progress.loaded)}
            </div>
          )}
        </div>
      </div>
      <ol className="mt-5 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("h-1 flex-1 rounded-full transition-colors duration-500", i < idx ? "bg-gold-500" : i === idx ? "bg-gold-500/50" : "bg-fg/8")} />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-ink-300 transition hover:bg-fg/6 hover:text-stone-100"
      >
        <CloseCircle size={14} /> {t("studio.load.cancel")}
      </button>
    </div>
  );
}
