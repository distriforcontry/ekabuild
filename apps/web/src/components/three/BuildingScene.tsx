"use client";
// The actual WebGL scene + glass control overlay. Loaded lazily (ssr:false) by BuildingViewer / BuildingThumb.
import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, Stars, useProgress } from "@react-three/drei";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import {
  Building4,
  Camera,
  Layer,
  Maximize4,
  Moon,
  Refresh,
  RotateRight,
  Scanning,
  Sun1,
  Maximize3,
  I3DCubeScan,
  Warning2,
} from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import type { MassingParams } from "@eka/shared";
import type { FileRef } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { ProceduralBuilding } from "./ProceduralBuilding";
import { GltfModel } from "./GltfModel";
import { boundsOf, resolveBlocks, type SceneBounds } from "./massing";

export type BuildingSceneProps = {
  model3d?: FileRef | null;
  massing?: MassingParams | null;
  floors?: number;
  progress?: number;
  name?: string;
  variant?: "full" | "compact";
  autoRotate?: boolean;
  className?: string;
};

type OrbitImpl = React.ComponentRef<typeof OrbitControls>;

const BG = {
  day: ["#eef1f4", "#d8dce1", "#c7c1b4"],
  night: ["#1a2031", "#0e1017", "#09090b"],
} as const;
const FOG = { day: "#d3cec4", night: "#0b0c10" } as const;

function boundsFromBox(box: THREE.Box3): SceneBounds {
  const size = box.getSize(new THREE.Vector3());
  const height = box.max.y;
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
    height,
    center: [(box.min.x + box.max.x) / 2, height / 2, (box.min.z + box.max.z) / 2],
    radius: Math.max(8, size.length() / 2),
  };
}

const DEFAULT_BOUNDS: SceneBounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30, height: 60, center: [0, 30, 0], radius: 50 };

// ───────────────────────────── in-canvas helpers ─────────────────────────────

/** Self-hosted CC0 HDRIs (public/hdri) for realistic glass & metal reflections. Never remote presets. */
const HDRI = { day: "/hdri/city.exr", night: "/hdri/night.exr" } as const;

class SilentBoundary extends React.Component<{ children: React.ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function EnvReady({ onReady }: { onReady: () => void }) {
  React.useEffect(() => onReady(), [onReady]);
  return null;
}

/** HDRI image-based lighting; if it can't load, the analytic lights alone still light the scene. */
function SceneEnvironment({ night, onReady }: { night: boolean; onReady: (v: boolean) => void }) {
  const ready = React.useCallback(() => onReady(true), [onReady]);
  return (
    <SilentBoundary onError={() => onReady(false)}>
      <React.Suspense fallback={null}>
        <Environment files={night ? HDRI.night : HDRI.day} environmentIntensity={night ? 0.55 : 0.85} />
        <EnvReady onReady={ready} />
      </React.Suspense>
    </SilentBoundary>
  );
}

function Lights({ night, bounds, env = false }: { night: boolean; bounds: SceneBounds; env?: boolean }) {
  const r = Math.max(30, bounds.radius);
  const amb = env ? 0.55 : 1;
  const [cx, , cz] = bounds.center;
  const setup = React.useCallback(
    (l: THREE.DirectionalLight | null) => {
      if (!l) return;
      l.shadow.mapSize.set(2048, 2048);
      const c = l.shadow.camera;
      c.left = -r * 1.4;
      c.right = r * 1.4;
      c.top = r * 1.4;
      c.bottom = -r * 1.4;
      c.near = 1;
      c.far = r * 8;
      c.updateProjectionMatrix();
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.04;
      l.target.position.set(cx, 0, cz);
      l.target.updateMatrixWorld();
    },
    [r, cx, cz],
  );
  if (night)
    return (
      <>
        <hemisphereLight args={["#2b3756", "#09090b", 0.5 * amb]} />
        <ambientLight intensity={0.12 * amb} color="#8090b0" />
        <directionalLight ref={setup} position={[cx - r * 1.2, r * 2.2, cz + r * 0.8]} intensity={0.75} color="#a9bcff" castShadow />
        <pointLight position={[cx, 6, bounds.maxZ + 10]} intensity={260} distance={80} decay={2} color="#ffc27a" />
        <pointLight position={[cx + r * 0.6, 3, cz - r * 0.6]} intensity={120} distance={50} decay={2} color="#ffb860" />
        <Stars radius={r * 9} depth={r * 2} count={1400} factor={4} saturation={0} fade speed={0} />
      </>
    );
  return (
    <>
      <hemisphereLight args={["#eaf2fb", "#4d4336", 0.95 * amb]} />
      <ambientLight intensity={0.2 * amb} />
      <directionalLight ref={setup} position={[cx + r * 1.3, r * 2.4, cz + r * 1.0]} intensity={env ? 2.1 : 2.6} color="#fff1dc" castShadow />
      <directionalLight position={[cx - r, r, cz - r]} intensity={0.45} color="#c9d8ff" />
    </>
  );
}

function Ground({ night, bounds }: { night: boolean; bounds: SceneBounds }) {
  const [cx, , cz] = bounds.center;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, cz]} receiveShadow>
      <circleGeometry args={[bounds.radius * 12 + 120, 64]} />
      <meshStandardMaterial color={night ? "#0e0f12" : "#bdb7aa"} roughness={1} />
    </mesh>
  );
}

function CameraRig({
  bounds,
  resetKey,
  controlsRef,
  cancelRef,
}: {
  bounds: SceneBounds;
  resetKey: number;
  controlsRef: React.RefObject<OrbitImpl | null>;
  cancelRef: React.MutableRefObject<() => void>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const [bx, by, bz] = bounds.center;
  const goal = React.useMemo(() => {
    const c = new THREE.Vector3(bx, by, bz);
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (bounds.radius / Math.sin(fov / 2)) * (aspect < 1 ? 1.45 / Math.max(0.55, aspect) : 1.02);
    const dir = new THREE.Vector3(1, 0.48, 1.3).normalize();
    return { pos: c.clone().add(dir.multiplyScalar(dist)), target: c };
  }, [bx, by, bz, bounds.radius, camera, aspect]);

  const animating = React.useRef(true);
  React.useEffect(() => {
    animating.current = true;
    invalidate();
  }, [goal, resetKey, invalidate]);
  React.useEffect(() => {
    cancelRef.current = () => (animating.current = false);
  }, [cancelRef]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    const ctl = controlsRef.current;
    const k = 1 - Math.exp(-4 * Math.min(dt, 0.05));
    camera.position.lerp(goal.pos, k);
    if (ctl) {
      ctl.target.lerp(goal.target, k);
      ctl.update();
    } else camera.lookAt(goal.target);
    const done = camera.position.distanceTo(goal.pos) < 0.05 && (!ctl || ctl.target.distanceTo(goal.target) < 0.05);
    if (done) animating.current = false;
    invalidate();
  });
  return null;
}

function Capture({ apiRef }: { apiRef: React.MutableRefObject<(() => HTMLCanvasElement) | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  React.useEffect(() => {
    apiRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement;
    };
    return () => {
      apiRef.current = null;
    };
  }, [gl, scene, camera, apiRef]);
  return null;
}

class ModelBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ───────────────────────────── DOM overlay bits ─────────────────────────────

function ToolButton({
  icon: I,
  label,
  active,
  onClick,
  side = "left",
}: {
  icon: Icon;
  label: string;
  active?: boolean;
  onClick: () => void;
  side?: "left" | "top" | "bottom" | "right";
}) {
  return (
    <Tooltip content={label} side={side}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "grid size-9 cursor-pointer place-items-center rounded-xl transition-all duration-300 active:scale-95",
          active ? "bg-gold-gradient text-onyx shadow-glow" : "text-ink-100 hover:bg-fg/10",
        )}
      >
        <I size={18} variant={active ? "Bold" : "Linear"} />
      </button>
    </Tooltip>
  );
}

function LoadingOverlay({ text }: { text: (pct: number) => string }) {
  const { active, progress } = useProgress();
  if (!active) return null;
  const pct = Math.round(progress);
  const c = 2 * Math.PI * 22;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/30 backdrop-blur-[2px]">
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lift">
        <svg width="52" height="52" className="-rotate-90">
          <circle cx="26" cy="26" r="22" stroke="var(--color-line-strong)" strokeWidth="4" fill="none" />
          <circle
            cx="26"
            cy="26"
            r="22"
            stroke="var(--color-gold-400)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: "stroke-dashoffset .3s" }}
          />
        </svg>
        <div className="text-sm text-ink-100">
          <div className="font-mono text-lg font-semibold text-stone-100">{pct}%</div>
          <div className="text-xs text-ink-300">{text(pct)}</div>
        </div>
      </div>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "eka-build";
}

// ───────────────────────────── main scene ─────────────────────────────

export default function BuildingScene({
  model3d = null,
  massing = null,
  floors = 12,
  progress = 100,
  name = "EKA BUILD",
  variant = "full",
  autoRotate = true,
  className,
}: BuildingSceneProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const full = variant === "full";

  const containerRef = React.useRef<HTMLDivElement>(null);
  const controlsRef = React.useRef<OrbitImpl | null>(null);
  const cancelRef = React.useRef<() => void>(() => {});
  const captureRef = React.useRef<(() => HTMLCanvasElement) | null>(null);

  const [nightManual, setNightManual] = React.useState<boolean | null>(null);
  const night = nightManual ?? resolvedTheme !== "light";
  const [rotate, setRotate] = React.useState(autoRotate && !reduce);
  const [xray, setXray] = React.useState(false);
  const [showProgress, setShowProgress] = React.useState(true);
  const [explode, setExplode] = React.useState(0);
  const [isolate, setIsolate] = React.useState(0);
  const [resetKey, setResetKey] = React.useState(0);
  const [isFs, setIsFs] = React.useState(false);
  const [modelFailed, setModelFailed] = React.useState(false);
  const [inView, setInView] = React.useState(true);
  const [gltfBox, setGltfBox] = React.useState<THREE.Box3 | null>(null);
  const [glbFloors, setGlbFloors] = React.useState(0);
  const [envReady, setEnvReady] = React.useState(false);

  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const useModel = Boolean(model3d?.url) && !modelFailed;
  const blocks = React.useMemo(() => resolveBlocks(massing, floors), [massing, floors]);
  const procFloors = Math.max(...blocks.map((b) => b.floors));
  const maxFloors = useModel ? glbFloors || floors : procFloors;
  const floorControls = full && (!useModel || glbFloors > 0);
  const procBounds = React.useMemo(() => boundsOf(blocks), [blocks]);
  const bounds = useModel ? (gltfBox ? boundsFromBox(gltfBox) : DEFAULT_BOUNDS) : procBounds;
  const bg = night ? BG.night : BG.day;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    const on = () => setIsFs(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  React.useEffect(() => {
    if (isolate > maxFloors) setIsolate(0);
  }, [maxFloors, isolate]);

  const toggleFs = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const screenshot = () => {
    const src = captureRef.current?.();
    if (!src) return;
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, bg[0]);
    g.addColorStop(0.55, bg[1]);
    g.addColorStop(1, bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${slug(name)}-3d.png`;
    a.click();
  };

  const floorLabel = React.useCallback((n: number) => t("catalog.viewer.floorLabel", { n }), [t]);
  const [cx, , cz] = bounds.center;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/viewer relative isolate size-full overflow-hidden rounded-[inherit] select-none [&:fullscreen]:rounded-none",
        className,
      )}
      style={{ background: `linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 55%, ${bg[2]} 100%)`, transition: "background .6s ease" }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 35, near: 0.5, far: 6000, position: [160, 110, 190] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        fallback={
          <div className="grid size-full place-items-center p-6 text-center text-sm text-ink-300">
            <span className="inline-flex items-center gap-2">
              <Warning2 size={18} className="text-warning" />
              {t("catalog.viewer.noWebgl")}
            </span>
          </div>
        }
        aria-label={name}
        className="touch-none"
      >
        <fog attach="fog" args={[night ? FOG.night : FOG.day, bounds.radius * 3.2, bounds.radius * 11]} />
        <Lights night={night} bounds={bounds} env={envReady} />
        <SceneEnvironment night={night} onReady={setEnvReady} />
        <React.Suspense fallback={null}>
          {useModel ? (
            <ModelBoundary onError={() => setModelFailed(true)}>
              <GltfModel
                url={model3d!.url}
                xray={xray}
                explode={full ? explode : 0}
                isolate={full ? isolate : 0}
                floorLabel={floorLabel}
                onBounds={setGltfBox}
                onFloors={setGlbFloors}
              />
              <Ground night={night} bounds={bounds} />
            </ModelBoundary>
          ) : (
            <ProceduralBuilding
              blocks={blocks}
              bounds={procBounds}
              progress={pct}
              showProgress={showProgress}
              look={{ night, xray, accent: massing?.accent }}
              explode={full ? explode : 0}
              isolate={full ? isolate : 0}
              floorLabel={floorLabel}
            />
          )}
        </React.Suspense>
        <ContactShadows
          position={[cx, 0.09, cz]}
          scale={bounds.radius * 3.4}
          blur={2.6}
          far={Math.max(10, bounds.height)}
          opacity={night ? 0.7 : 0.45}
          resolution={512}
          color="#000000"
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          autoRotate={rotate && inView}
          autoRotateSpeed={0.5}
          minDistance={bounds.radius * 0.55}
          maxDistance={bounds.radius * 5.5}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minPolarAngle={0.12}
          enablePan={full}
          screenSpacePanning
          onStart={() => cancelRef.current()}
        />
        <CameraRig bounds={bounds} resetKey={resetKey} controlsRef={controlsRef} cancelRef={cancelRef} />
        <Capture apiRef={captureRef} />
      </Canvas>

      <LoadingOverlay text={() => t("catalog.viewer.loading")} />

      {/* info chip */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-100 shadow-card">
          <I3DCubeScan size={15} variant="Bold" className="text-gold-300" />
          {useModel ? t("catalog.viewer.uploaded") : t("catalog.viewer.procedural")}
          <span className="text-ink-400">·</span>
          <span className="font-mono">{t("catalog.viewer.floors", { count: maxFloors })}</span>
          {pct < 100 && !useModel && (
            <>
              <span className="text-ink-400">·</span>
              <span className="font-mono text-gold-200">{t("catalog.viewer.built", { pct })}</span>
            </>
          )}
        </div>
        {modelFailed && (
          <div className="glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-warning shadow-card">
            <Warning2 size={14} /> {t("catalog.viewer.modelError")}
          </div>
        )}
      </div>

      {/* toolbar */}
      <div
        role="toolbar"
        aria-label={t("catalog.viewer.controls")}
        className="glass absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-2xl p-1.5 shadow-card"
      >
        <ToolButton icon={RotateRight} label={t("catalog.viewer.rotate")} active={rotate} onClick={() => setRotate((r) => !r)} />
        {full && <ToolButton icon={Refresh} label={t("catalog.viewer.reset")} onClick={() => setResetKey((k) => k + 1)} />}
        <ToolButton
          icon={night ? Moon : Sun1}
          label={night ? t("catalog.viewer.day") : t("catalog.viewer.night")}
          onClick={() => setNightManual(!night)}
        />
        {full && <ToolButton icon={Scanning} label={t("catalog.viewer.xray")} active={xray} onClick={() => setXray((x) => !x)} />}
        {full && !useModel && pct < 100 && (
          <ToolButton icon={Building4} label={t("catalog.viewer.progress")} active={showProgress} onClick={() => setShowProgress((s) => !s)} />
        )}
        <ToolButton
          icon={isFs ? Maximize3 : Maximize4}
          label={isFs ? t("catalog.viewer.exitFullscreen") : t("catalog.viewer.fullscreen")}
          onClick={toggleFs}
        />
        {full && <ToolButton icon={Camera} label={t("catalog.viewer.screenshot")} onClick={screenshot} />}
      </div>

      {/* sliders */}
      {floorControls && (
        <div className="glass absolute inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-2xl p-3 shadow-card sm:right-auto sm:w-[min(560px,calc(100%-5.5rem))] sm:flex-row sm:items-center sm:gap-5 sm:px-4">
          <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-ink-200">
            <Layer size={17} className="shrink-0 text-gold-300" />
            <span className="w-24 shrink-0 truncate sm:w-auto">{t("catalog.viewer.explode")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explode}
              onChange={(e) => setExplode(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-gold-500"
              aria-label={t("catalog.viewer.explode")}
            />
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-ink-200">
            <Building4 size={17} className="shrink-0 text-gold-300" />
            <span className="w-24 shrink-0 truncate font-mono text-gold-200 sm:w-20">
              {isolate ? t("catalog.viewer.floorLabel", { n: isolate }) : t("catalog.viewer.allFloors")}
            </span>
            <input
              type="range"
              min={0}
              max={maxFloors}
              step={1}
              value={isolate}
              onChange={(e) => setIsolate(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-gold-500"
              aria-label={t("catalog.viewer.isolate")}
              aria-valuetext={isolate ? t("catalog.viewer.floorLabel", { n: isolate }) : t("catalog.viewer.allFloors")}
            />
          </label>
        </div>
      )}

      {full && !useModel && pct < 100 && showProgress && (
        <div className="glass pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-3 rounded-xl px-3 py-2 text-[11px] text-ink-200 shadow-card md:flex">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-gold-400" /> {t("catalog.viewer.legendBuilt")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-gold-400" /> {t("catalog.viewer.legendPlanned")}
          </span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── lightweight thumb ─────────────────────────────

/** Small auto-rotating procedural building without controls (cards, hero decorations). */
export function ThumbScene({
  massing = null,
  floors = 12,
  progress = 100,
  night: nightProp,
  className,
}: {
  massing?: MassingParams | null;
  floors?: number;
  progress?: number;
  night?: boolean;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const night = nightProp ?? resolvedTheme !== "light";
  const blocks = React.useMemo(() => resolveBlocks(massing, floors), [massing, floors]);
  const bounds = React.useMemo(() => boundsOf(blocks), [blocks]);
  const controlsRef = React.useRef<OrbitImpl | null>(null);
  const cancelRef = React.useRef<() => void>(() => {});
  const [envReady, setEnvReady] = React.useState(false);
  const [cx, , cz] = bounds.center;
  return (
    <div className={cn("relative size-full", className)}>
      <Canvas shadows dpr={[1, 1.5]} frameloop="demand" camera={{ fov: 35, position: [160, 110, 190] }} gl={{ antialias: true, alpha: true }}>
        <fog attach="fog" args={[night ? "#0b0c0e" : "#f6f4ef", bounds.radius * 2.6, bounds.radius * 6]} />
        <Lights night={night} bounds={bounds} env={envReady} />
        <SceneEnvironment night={night} onReady={setEnvReady} />
        <ProceduralBuilding
          blocks={blocks}
          bounds={bounds}
          progress={Math.round(progress)}
          showProgress
          look={{ night, xray: false, accent: massing?.accent }}
          explode={0}
          isolate={0}
          floorLabel={String}
        />
        <ContactShadows position={[cx, 0.09, cz]} scale={bounds.radius * 3} blur={2.4} far={bounds.height} opacity={0.5} resolution={256} />
        <OrbitControls ref={controlsRef} enableZoom={false} enablePan={false} enableRotate={false} autoRotate={!reduce} autoRotateSpeed={0.8} />
        <CameraRig bounds={bounds} resetKey={0} controlsRef={controlsRef} cancelRef={cancelRef} />
      </Canvas>
    </div>
  );
}
