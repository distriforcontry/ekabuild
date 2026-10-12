"use client";
import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural luxury tower for the landing hero: dark glass floors wrapped in brushed-gold fins,
 * a slight twist and taper, a stone podium and a gold crown with a "1"-blade echoing the logo.
 * Floors assemble bottom → top on load, the tower slowly turns and leans toward the cursor.
 * Loaded with next/dynamic (ssr:false) from HeroVisual.
 */

type Theme = "dark" | "light";
export type HeroBuildingProps = { active: boolean; started: boolean; theme: Theme; reduced: boolean; onReady?: () => void };

const FLOORS = 22;
const FLOOR_H = 0.3;
const SLAB_H = 0.055;
const PODIUM_H = 0.62;
const BASE_W = 2.05;
const BASE_D = 1.55;
const TWIST = 0.016;
const TAPER = 0.17;
const TOP_Y = PODIUM_H + FLOORS * FLOOR_H;
const CAM = new THREE.Vector3(7.9, 5.4, 13.4);
const LOOK = new THREE.Vector3(0, 4.3, 0);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

type FloorSpec = { w: number; d: number; y: number; rot: number; lit: boolean; sky: boolean };

function floorSpec(i: number): FloorSpec {
  const k = i / (FLOORS - 1);
  const s = 1 - TAPER * k;
  return {
    w: BASE_W * s,
    d: BASE_D * s,
    y: PODIUM_H + i * FLOOR_H + FLOOR_H / 2,
    rot: i * TWIST,
    lit: (i * 7 + 3) % 5 === 0 || i === FLOORS - 2,
    sky: i % 7 === 6,
  };
}

/** Vertical fins around a floor, merged into a single geometry. */
function finsGeometry(w: number, d: number, h: number) {
  const parts: THREE.BufferGeometry[] = [];
  const finT = 0.022;
  const finD = 0.075;
  const nW = Math.max(5, Math.round(w / 0.26));
  const nD = Math.max(4, Math.round(d / 0.26));
  for (let j = 0; j <= nW; j++) {
    const x = -w / 2 + (w * j) / nW;
    for (const z of [d / 2 + finD / 2 - 0.012, -d / 2 - finD / 2 + 0.012]) {
      const g = new THREE.BoxGeometry(finT, h, finD);
      g.translate(x, 0, z);
      parts.push(g);
    }
  }
  for (let j = 1; j < nD; j++) {
    const z = -d / 2 + (d * j) / nD;
    for (const x of [w / 2 + finD / 2 - 0.012, -w / 2 - finD / 2 + 0.012]) {
      const g = new THREE.BoxGeometry(finD, h, finT);
      g.translate(x, 0, z);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return merged;
}

function useMaterials(theme: Theme) {
  const mats = React.useMemo(() => {
    const dark = theme === "dark";
    const glassBase = {
      color: new THREE.Color(dark ? "#16212a" : "#2a3946"),
      metalness: 0.35,
      roughness: 0.05,
      ior: 1.52,
      reflectivity: 0.9,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: dark ? 1.9 : 1.5,
    };
    // brushed gold: anisotropic highlights stretched along the fins
    const goldBase = {
      color: new THREE.Color("#c9a464"),
      metalness: 1,
      roughness: 0.3,
      anisotropy: 0.85,
      anisotropyRotation: Math.PI / 2,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.6,
    };
    return {
      glass: new THREE.MeshPhysicalMaterial(glassBase),
      glassLit: new THREE.MeshPhysicalMaterial({ ...glassBase, emissive: new THREE.Color("#e2b977"), emissiveIntensity: dark ? 0.32 : 0.18 }),
      slab: new THREE.MeshStandardMaterial({ color: dark ? "#2a2b30" : "#d8d2c5", roughness: 0.55, metalness: 0.15 }),
      gold: new THREE.MeshPhysicalMaterial(goldBase),
      goldBright: new THREE.MeshPhysicalMaterial({
        ...goldBase,
        color: new THREE.Color("#e6cb8f"),
        roughness: 0.2,
        emissive: new THREE.Color("#c9a464"),
        emissiveIntensity: 0.1,
      }),
      stone: new THREE.MeshStandardMaterial({ color: dark ? "#17181c" : "#e6e0d3", roughness: 0.75, metalness: 0.05 }),
    };
  }, [theme]);
  React.useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

type Mats = ReturnType<typeof useMaterials>;
type Clock = React.RefObject<number>;

function Floor({ index, spec, mats, clock, reduced }: { index: number; spec: FloorSpec; mats: Mats; clock: Clock; reduced: boolean }) {
  const ref = React.useRef<THREE.Group>(null);
  const glassH = FLOOR_H - SLAB_H;
  const geos = React.useMemo(
    () => ({
      slab: new THREE.BoxGeometry(spec.w + 0.09, SLAB_H, spec.d + 0.09),
      glass: new THREE.BoxGeometry(spec.w, glassH, spec.d),
      fins: finsGeometry(spec.w, spec.d, glassH),
    }),
    [spec.w, spec.d, glassH],
  );
  React.useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  useFrame(() => {
    const g = ref.current;
    if (!g || g.userData.done) return;
    if (reduced) {
      g.visible = true;
      g.userData.done = true;
      return;
    }
    const t = clock.current - 0.35 - index * 0.06;
    const p = clamp01(t / 0.7);
    const e = easeOut(p);
    g.visible = p > 0;
    g.position.y = spec.y - (1 - e) * 1.1;
    const s = 0.9 + 0.1 * e;
    g.scale.set(s, Math.max(0.001, e), s);
    if (p >= 1) {
      g.position.y = spec.y;
      g.scale.set(1, 1, 1);
      g.userData.done = true;
    }
  });

  return (
    <group ref={ref} position-y={spec.y} rotation-y={spec.rot} visible={reduced}>
      <mesh geometry={geos.slab} material={spec.sky ? mats.goldBright : mats.slab} position-y={-glassH / 2} />
      <mesh geometry={geos.glass} material={spec.lit ? mats.glassLit : mats.glass} position-y={SLAB_H / 2} />
      <mesh geometry={geos.fins} material={mats.gold} position-y={SLAB_H / 2} />
    </group>
  );
}

function Podium({ mats, clock, reduced }: { mats: Mats; clock: Clock; reduced: boolean }) {
  const ref = React.useRef<THREE.Group>(null);
  const w = BASE_W * 1.38;
  const d = BASE_D * 1.38;
  useFrame(() => {
    const g = ref.current;
    if (!g || g.userData.done) return;
    const e = reduced ? 1 : easeOut(clamp01(clock.current / 0.6));
    g.scale.set(1, Math.max(0.001, e), 1);
    if (e >= 1) g.userData.done = true;
  });
  return (
    <group ref={ref}>
      <mesh position-y={PODIUM_H / 2} material={mats.stone}>
        <boxGeometry args={[w, PODIUM_H, d]} />
      </mesh>
      <mesh position-y={PODIUM_H * 0.42} material={mats.glassLit}>
        <boxGeometry args={[w + 0.02, PODIUM_H * 0.5, d + 0.02]} />
      </mesh>
      <mesh position-y={PODIUM_H - 0.015} material={mats.gold}>
        <boxGeometry args={[w + 0.06, 0.03, d + 0.06]} />
      </mesh>
    </group>
  );
}

function Crown({ mats, clock, reduced }: { mats: Mats; clock: Clock; reduced: boolean }) {
  const ref = React.useRef<THREE.Group>(null);
  const top = floorSpec(FLOORS - 1);
  const start = 0.35 + FLOORS * 0.06 + 0.25;
  useFrame(() => {
    const g = ref.current;
    if (!g || g.userData.done) return;
    const p = reduced ? 1 : clamp01((clock.current - start) / 0.8);
    const e = p >= 1 ? 1 : easeOutBack(p);
    g.visible = p > 0;
    g.scale.set(1, Math.max(0.001, e), 1);
    if (p >= 1) g.userData.done = true;
  });
  const w = top.w + 0.09;
  const d = top.d + 0.09;
  const ph = 0.26;
  const t = 0.04;
  return (
    <group ref={ref} position-y={TOP_Y} rotation-y={top.rot} visible={reduced}>
      {/* roof slab */}
      <mesh position-y={0.025} material={mats.slab}>
        <boxGeometry args={[w, 0.05, d]} />
      </mesh>
      {/* gold parapet frame */}
      {[
        { p: [0, ph / 2, d / 2] as const, s: [w, ph, t] as const },
        { p: [0, ph / 2, -d / 2] as const, s: [w, ph, t] as const },
        { p: [w / 2, ph / 2, 0] as const, s: [t, ph, d] as const },
        { p: [-w / 2, ph / 2, 0] as const, s: [t, ph, d] as const },
      ].map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1], b.p[2]]} material={mats.goldBright}>
          <boxGeometry args={[b.s[0], b.s[1], b.s[2]]} />
        </mesh>
      ))}
      {/* the "1" blade */}
      <mesh position={[w / 2 - 0.2, 0.7, d / 2 - 0.28]} material={mats.goldBright}>
        <boxGeometry args={[0.16, 1.4, 0.06]} />
      </mesh>
      <mesh position={[w / 2 - 0.34, 1.24, d / 2 - 0.28]} rotation-z={-0.69} material={mats.goldBright}>
        <boxGeometry args={[0.07, 0.4, 0.05]} />
      </mesh>
      {/* mechanical penthouse */}
      <mesh position={[-0.25, 0.2, -0.1]} material={mats.glass}>
        <boxGeometry args={[w * 0.4, 0.34, d * 0.45]} />
      </mesh>
    </group>
  );
}

function Ground({ theme }: { theme: Theme }) {
  const alpha = React.useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  React.useEffect(() => () => alpha?.dispose(), [alpha]);
  const dark = theme === "dark";
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002}>
        <circleGeometry args={[4.2, 96]} />
        <meshStandardMaterial color={dark ? "#15161a" : "#e9e4da"} roughness={0.95} transparent alphaMap={alpha ?? undefined} />
      </mesh>
      {[2.7, 3.35].map((r, i) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position-y={0.004}>
          <ringGeometry args={[r, r + (i ? 0.012 : 0.022), 160]} />
          <meshBasicMaterial color="#c9a464" transparent opacity={i ? 0.25 : 0.55} />
        </mesh>
      ))}
    </group>
  );
}

function useWindowPointer() {
  const ref = React.useRef({ x: 0, y: 0 });
  React.useEffect(() => {
    const on = (e: PointerEvent) => {
      ref.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ref.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
  return ref;
}

function Tower({ theme, reduced, started }: { theme: Theme; reduced: boolean; started: boolean }) {
  const mats = useMaterials(theme);
  const startedRef = React.useRef(started);
  startedRef.current = started;
  const group = React.useRef<THREE.Group>(null);
  const clock = React.useRef(0);
  const spin = React.useRef(-0.55);
  const pointer = useWindowPointer();
  const specs = React.useMemo(() => Array.from({ length: FLOORS }, (_, i) => floorSpec(i)), []);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    if (startedRef.current || reduced) clock.current += d;
    const g = group.current;
    if (!g) return;
    if (!reduced) spin.current += d * 0.11;
    const px = reduced ? 0 : pointer.current.x;
    const py = reduced ? 0 : pointer.current.y;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, spin.current + px * 0.35, 3.5, d);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -py * 0.035, 3, d);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -px * 0.02, 3, d);
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, CAM.x + px * 0.6, 2.5, d);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, CAM.y + py * 0.35, 2.5, d);
    cam.lookAt(LOOK);
  });

  return (
    <group ref={group} rotation-y={-0.55}>
      <Podium mats={mats} clock={clock} reduced={reduced} />
      {specs.map((s, i) => (
        <Floor key={i} index={i} spec={s} mats={mats} clock={clock} reduced={reduced} />
      ))}
      <Crown mats={mats} clock={clock} reduced={reduced} />
    </group>
  );
}

/** ACES filmic tone mapping, exposure tuned per theme. */
function ToneMapping({ theme }: { theme: Theme }) {
  const gl = useThree((s) => s.gl);
  React.useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = theme === "dark" ? 1.05 : 1.15;
  }, [gl, theme]);
  return null;
}

/** Procedural studio lighting used until the HDRI has loaded (no network needed). */
function StudioRig() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={2.4} color="#fff6e6" position={[0, 6, -9]} scale={[14, 3, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#e6cb8f" position={[8, 2, 3]} rotation-y={-Math.PI / 2} scale={[8, 6, 1]} />
      <Lightformer form="ring" intensity={3} color="#c9a464" position={[4, 9, 6]} scale={3} />
      <Lightformer form="circle" intensity={1.2} color="#9fb3c4" position={[0, -4, 6]} scale={6} />
    </Environment>
  );
}

export default function HeroBuilding({ active, started, theme, reduced, onReady }: HeroBuildingProps) {
  return (
    <Canvas
      aria-hidden
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [CAM.x, CAM.y, CAM.z], fov: 35, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ camera }) => {
        camera.lookAt(LOOK);
        onReady?.();
      }}
    >
      <ToneMapping theme={theme} />
      <ambientLight intensity={theme === "dark" ? 0.35 : 0.55} />
      <directionalLight position={[6, 9, 5]} intensity={1.7} color="#fff3dc" />
      <directionalLight position={[-7, 4, -5]} intensity={0.9} color="#c9a464" />
      <pointLight position={[0, 1.2, 3.4]} intensity={6} distance={7} color="#e6cb8f" />

      {/* Self-hosted CC0 HDRI (public/hdri) for real glass & gold reflections; the light-former rig
          renders instantly while the EXR streams in. */}
      <React.Suspense fallback={<StudioRig />}>
        <Environment
          files={theme === "dark" ? "/hdri/sunset.exr" : "/hdri/city.exr"}
          environmentIntensity={theme === "dark" ? 0.95 : 1.1}
          environmentRotation={[0, Math.PI / 3, 0]}
        />
      </React.Suspense>

      <Tower theme={theme} reduced={reduced} started={started} />
      <Ground theme={theme} />
      <ContactShadows
        position={[0, 0.006, 0]}
        scale={8}
        blur={2.6}
        far={5}
        resolution={512}
        opacity={theme === "dark" ? 0.7 : 0.35}
        color="#000000"
      />
    </Canvas>
  );
}
