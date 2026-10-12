"use client";
// Procedural building generated from MassingParams: plinth, per-floor slabs, glass curtain walls,
// gold vertical fins, lobby canopy, rooftop crown, construction-progress ghost floors + scaffold + crane.
import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  EXPLODE_GAP,
  FLOOR_H,
  GROUND_H,
  PLINTH_H,
  blockHeight,
  builtFloors,
  floorBase,
  floorHeight,
  rand,
  type Block,
  type SceneBounds,
} from "./massing";

export type Look = { night: boolean; xray: boolean; accent?: string };

type Mats = ReturnType<typeof createMaterials>;

function createMaterials(accent?: string) {
  return {
    slab: new THREE.MeshStandardMaterial({ color: "#e4ded1", roughness: 0.82, metalness: 0.02 }),
    stone: new THREE.MeshStandardMaterial({ color: "#d3ccbc", roughness: 0.92 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2a2c31", roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: accent ?? "#8fa9c0",
      roughness: 0.06,
      metalness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.1,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      emissive: "#30475d",
      emissiveIntensity: 0.22,
    }),
    lobby: new THREE.MeshPhysicalMaterial({
      color: "#5b6a76",
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      emissive: "#ffcf8f",
      emissiveIntensity: 0.05,
    }),
    glassHi: new THREE.MeshPhysicalMaterial({
      color: "#ead09a",
      emissive: "#c9a464",
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.88,
      roughness: 0.2,
      clearcoat: 1,
      depthWrite: false,
    }),
    glassDim: new THREE.MeshBasicMaterial({ color: "#9fb2c4", transparent: true, opacity: 0.05, depthWrite: false }),
    core: new THREE.MeshStandardMaterial({ color: "#1f2126", roughness: 0.95 }),
    coreLit: new THREE.MeshStandardMaterial({ color: "#3a3024", emissive: "#ffc983", emissiveIntensity: 1.3, roughness: 0.9 }),
    fin: new THREE.MeshStandardMaterial({ color: "#c9a464", metalness: 0.75, roughness: 0.28, emissive: "#3b2a0e", emissiveIntensity: 0.3 }),
    dim: new THREE.MeshStandardMaterial({ color: "#cfc8ba", transparent: true, opacity: 0.12, depthWrite: false }),
    ghost: new THREE.MeshBasicMaterial({ color: "#c9a464", wireframe: true, transparent: true, opacity: 0.32, depthWrite: false }),
    ghostDim: new THREE.MeshBasicMaterial({ color: "#c9a464", wireframe: true, transparent: true, opacity: 0.08, depthWrite: false }),
    scaffold: new THREE.MeshBasicMaterial({ color: "#e8b04b", wireframe: true, transparent: true, opacity: 0.75 }),
    crane: new THREE.MeshStandardMaterial({ color: "#e8b04b", roughness: 0.5, metalness: 0.3 }),
    lattice: new THREE.MeshBasicMaterial({ color: "#e8b04b", wireframe: true }),
    tree: new THREE.MeshStandardMaterial({ color: "#5d7a52", roughness: 1, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5b4636", roughness: 1 }),
    paving: new THREE.MeshStandardMaterial({ color: "#cfc9bc", roughness: 1 }),
    ground: new THREE.MeshStandardMaterial({ color: "#b8b2a4", roughness: 1 }),
  };
}

function useMaterials({ night, xray, accent }: Look): Mats {
  const invalidate = useThree((s) => s.invalidate);
  const mats = React.useMemo(() => createMaterials(accent), [accent]);

  React.useEffect(() => {
    mats.glass.opacity = xray ? 0.07 : night ? 0.82 : 0.6;
    mats.glass.color.set(night ? "#1f2b37" : (accent ?? "#8fa9c0"));
    mats.glass.emissive.set(night ? "#0b1520" : "#30475d");
    mats.lobby.emissiveIntensity = night ? 0.55 : 0.05;
    mats.lobby.opacity = xray ? 0.07 : 0.7;
    mats.slab.wireframe = xray;
    mats.stone.wireframe = xray;
    mats.slab.color.set(xray ? "#c9a464" : night ? "#9c968b" : "#e4ded1");
    mats.stone.color.set(xray ? "#c9a464" : night ? "#6f6a60" : "#d3ccbc");
    mats.coreLit.emissiveIntensity = night ? 1.4 : 0;
    mats.coreLit.color.set(night ? "#3a3024" : "#1f2126");
    mats.paving.color.set(night ? "#1d1e22" : "#cfc9bc");
    mats.ground.color.set(night ? "#0e0f12" : "#b8b2a4");
    mats.tree.color.set(night ? "#1f2b1e" : "#5d7a52");
    mats.fin.emissiveIntensity = night ? 0.55 : 0.35;
    Object.values(mats).forEach((m) => (m.needsUpdate = true));
    invalidate();
  }, [mats, night, xray, accent, invalidate]);

  React.useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

function finsGeometry(w: number, d: number, h: number) {
  const parts: THREE.BufferGeometry[] = [];
  const nx = Math.max(2, Math.round(w / 2.8));
  const nz = Math.max(2, Math.round(d / 2.8));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + (w * i) / nx;
    for (const z of [d / 2 + 0.2, -d / 2 - 0.2]) {
      const g = new THREE.BoxGeometry(0.16, h, 0.42);
      g.translate(x, 0, z);
      parts.push(g);
    }
  }
  for (let i = 1; i < nz; i++) {
    const z = -d / 2 + (d * i) / nz;
    for (const x of [w / 2 + 0.2, -w / 2 - 0.2]) {
      const g = new THREE.BoxGeometry(0.42, h, 0.16);
      g.translate(x, 0, z);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return merged;
}

function useBlockGeometries(w: number, d: number) {
  const geo = React.useMemo(() => {
    const seg = (n: number) => Math.max(1, Math.round(n / 5));
    return {
      slab: new THREE.BoxGeometry(w + 0.7, 0.34, d + 0.7),
      glassT: new THREE.BoxGeometry(w, FLOOR_H - 0.34, d),
      glassG: new THREE.BoxGeometry(w, GROUND_H - 0.34, d),
      coreT: new THREE.BoxGeometry(w - 1.6, FLOOR_H - 0.5, d - 1.6),
      coreG: new THREE.BoxGeometry(w - 1.6, GROUND_H - 0.5, d - 1.6),
      finsT: finsGeometry(w, d, FLOOR_H - 0.34),
      finsG: finsGeometry(w, d, GROUND_H - 0.34),
      ghostT: new THREE.BoxGeometry(w, FLOOR_H, d, seg(w), 1, seg(d)),
      ghostG: new THREE.BoxGeometry(w, GROUND_H, d, seg(w), 1, seg(d)),
      scaffold: new THREE.BoxGeometry(w + 1.4, FLOOR_H * 1.6, d + 1.4, Math.max(2, Math.round(w / 2)), 3, Math.max(2, Math.round(d / 2))),
      roof: new THREE.BoxGeometry(w + 0.7, 0.5, d + 0.7),
      parapetX: new THREE.BoxGeometry(w + 0.7, 1.1, 0.25),
      parapetZ: new THREE.BoxGeometry(0.25, 1.1, d + 0.7),
      crownX: new THREE.BoxGeometry(w + 1, 0.22, 0.42),
      crownZ: new THREE.BoxGeometry(0.42, 0.22, d + 1),
      penthouse: new THREE.BoxGeometry(w * 0.42, 3.2, d * 0.45),
      penthouseBand: new THREE.BoxGeometry(w * 0.42 + 0.1, 1.1, d * 0.45 + 0.1),
      canopy: new THREE.BoxGeometry(Math.min(w * 0.42, 11), 0.28, 2.8),
    };
  }, [w, d]);
  React.useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return geo;
}

type Geo = ReturnType<typeof useBlockGeometries>;
type FloorState = "normal" | "hi" | "dim" | "ghost" | "ghostDim" | "build";
type Registry = { items: Map<string, { g: THREE.Object3D; baseY: number; k: number }>; value: number };

const Floor = React.memo(function Floor({
  id,
  k,
  state,
  lit,
  xray,
  geo,
  mats,
  registry,
  label,
  w,
  d,
}: {
  id: string;
  k: number;
  state: FloorState;
  lit: boolean;
  xray: boolean;
  geo: Geo;
  mats: Mats;
  registry: Registry;
  label?: string;
  w: number;
  d: number;
}) {
  const ref = React.useRef<THREE.Group>(null);
  const baseY = floorBase(k);
  React.useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    registry.items.set(id, { g, baseY, k });
    g.position.y = baseY + (k - 1) * registry.value * EXPLODE_GAP;
    return () => {
      registry.items.delete(id);
    };
  }, [id, baseY, k, registry]);

  const ground = k === 1;
  const h = floorHeight(k);
  const midY = 0.34 + (h - 0.34) / 2;

  return (
    <group ref={ref}>
      {state === "ghost" || state === "ghostDim" ? (
        <mesh geometry={ground ? geo.ghostG : geo.ghostT} material={state === "ghost" ? mats.ghost : mats.ghostDim} position={[0, h / 2, 0]} />
      ) : state === "build" ? (
        <>
          <mesh geometry={geo.slab} material={mats.slab} position={[0, 0.17, 0]} castShadow receiveShadow />
          <mesh geometry={geo.scaffold} material={mats.scaffold} position={[0, (FLOOR_H * 1.6) / 2, 0]} />
        </>
      ) : (
        <>
          <mesh
            geometry={geo.slab}
            material={state === "hi" ? mats.fin : state === "dim" ? mats.dim : mats.slab}
            position={[0, 0.17, 0]}
            castShadow={state !== "dim"}
            receiveShadow
          />
          {!xray && state !== "dim" && (
            <mesh geometry={ground ? geo.coreG : geo.coreT} material={lit || state === "hi" ? mats.coreLit : mats.core} position={[0, midY, 0]} castShadow />
          )}
          <mesh
            geometry={ground ? geo.glassG : geo.glassT}
            material={state === "hi" ? mats.glassHi : state === "dim" ? mats.glassDim : ground ? mats.lobby : mats.glass}
            position={[0, midY, 0]}
          />
          {state !== "dim" && <mesh geometry={ground ? geo.finsG : geo.finsT} material={mats.fin} position={[0, midY, 0]} castShadow />}
        </>
      )}
      {label && (
        <Html position={[w / 2 + 1.2, h / 2, d / 2 + 1.2]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-full bg-gold-gradient px-3 py-1 font-mono text-xs font-bold text-onyx shadow-glow">{label}</div>
        </Html>
      )}
    </group>
  );
});

function Roof({ id, floors, geo, mats, registry, xray }: { id: string; floors: number; geo: Geo; mats: Mats; registry: Registry; xray: boolean }) {
  const ref = React.useRef<THREE.Group>(null);
  const baseY = blockHeight(floors);
  const k = floors + 1;
  React.useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    registry.items.set(id, { g, baseY, k });
    g.position.y = baseY + (k - 1) * registry.value * EXPLODE_GAP;
    return () => {
      registry.items.delete(id);
    };
  }, [id, baseY, k, registry]);
  const p = geo.parapetX.parameters;
  const q = geo.parapetZ.parameters;
  return (
    <group ref={ref}>
      <mesh geometry={geo.roof} material={mats.slab} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh geometry={geo.parapetX} material={mats.stone} position={[0, 1.05, q.depth / 2 - 0.12]} castShadow />
      <mesh geometry={geo.parapetX} material={mats.stone} position={[0, 1.05, -q.depth / 2 + 0.12]} castShadow />
      <mesh geometry={geo.parapetZ} material={mats.stone} position={[p.width / 2 - 0.12, 1.05, 0]} castShadow />
      <mesh geometry={geo.parapetZ} material={mats.stone} position={[-p.width / 2 + 0.12, 1.05, 0]} castShadow />
      <mesh geometry={geo.crownX} material={mats.fin} position={[0, 1.7, q.depth / 2 - 0.12]} />
      <mesh geometry={geo.crownX} material={mats.fin} position={[0, 1.7, -q.depth / 2 + 0.12]} />
      <mesh geometry={geo.crownZ} material={mats.fin} position={[p.width / 2 - 0.12, 1.7, 0]} />
      <mesh geometry={geo.crownZ} material={mats.fin} position={[-p.width / 2 + 0.12, 1.7, 0]} />
      {!xray && (
        <>
          <mesh geometry={geo.penthouse} material={mats.stone} position={[0, 0.5 + 1.6, 0]} castShadow />
          <mesh geometry={geo.penthouseBand} material={mats.glass} position={[0, 0.5 + 2.2, 0]} />
        </>
      )}
    </group>
  );
}

function BlockMesh({
  block,
  index,
  progress,
  showProgress,
  isolate,
  look,
  mats,
  registry,
  floorLabel,
}: {
  block: Block;
  index: number;
  progress: number;
  showProgress: boolean;
  isolate: number;
  look: Look;
  mats: Mats;
  registry: Registry;
  floorLabel: (n: number) => string;
}) {
  const geo = useBlockGeometries(block.width, block.depth);
  const built = showProgress ? builtFloors(block.floors, progress) : block.floors;
  const floors = Array.from({ length: block.floors }, (_, i) => i + 1);

  return (
    <group position={[block.x, PLINTH_H, block.z]}>
      {floors.map((k) => {
        let state: FloorState;
        if (k > built) state = k === built + 1 && progress > 0 && progress < 100 ? "build" : isolate && isolate !== k ? "ghostDim" : "ghost";
        else if (isolate) state = k === isolate ? "hi" : "dim";
        else state = "normal";
        const lit = look.night && (k === 1 || rand(k * 31 + index * 7) > 0.52);
        return (
          <Floor
            key={k}
            id={`${block.key}-${k}`}
            k={k}
            state={state}
            lit={lit}
            xray={look.xray}
            geo={geo}
            mats={mats}
            registry={registry}
            w={block.width}
            d={block.depth}
            label={index === 0 && isolate === k ? floorLabel(k) : undefined}
          />
        );
      })}
      {built >= block.floors && <Roof id={`${block.key}-roof`} floors={block.floors} geo={geo} mats={mats} registry={registry} xray={look.xray} />}
      {index === 0 && built >= 1 && !look.xray && (
        <mesh geometry={geo.canopy} material={mats.fin} position={[0, GROUND_H - 0.7, block.depth / 2 + 1.5]} castShadow />
      )}
    </group>
  );
}

function Crane({ x, z, height, mats }: { x: number; z: number; height: number; mats: Mats }) {
  const jib = 34;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} material={mats.lattice}>
        <boxGeometry args={[1.6, height, 1.6, 1, Math.max(4, Math.round(height / 2)), 1]} />
      </mesh>
      <mesh position={[0, height / 2, 0]} material={mats.crane} castShadow>
        <boxGeometry args={[0.35, height, 0.35]} />
      </mesh>
      <mesh position={[0.3, height + 1.2, 0]} material={mats.crane} castShadow>
        <boxGeometry args={[2.4, 2.2, 2.2]} />
      </mesh>
      <mesh position={[-jib / 2 + 2, height + 2.7, 0]} material={mats.lattice}>
        <boxGeometry args={[jib, 1.2, 1.2, Math.round(jib / 1.5), 1, 1]} />
      </mesh>
      <mesh position={[-jib / 2 + 2, height + 2.7, 0]} material={mats.crane} castShadow>
        <boxGeometry args={[jib, 0.22, 0.22]} />
      </mesh>
      <mesh position={[6.5, height + 2.7, 0]} material={mats.lattice}>
        <boxGeometry args={[9, 1, 1, 6, 1, 1]} />
      </mesh>
      <mesh position={[9.8, height + 1.8, 0]} material={mats.dark} castShadow>
        <boxGeometry args={[2.4, 2, 1.8]} />
      </mesh>
      <mesh position={[0, height + 5.6, 0]} material={mats.lattice}>
        <boxGeometry args={[1, 5, 1, 1, 3, 1]} />
      </mesh>
      <mesh position={[-jib + 12, height + 2.7 - 7, 0]} material={mats.dark}>
        <cylinderGeometry args={[0.05, 0.05, 14, 6]} />
      </mesh>
      <mesh position={[-jib + 12, height + 2.7 - 14.4, 0]} material={mats.crane}>
        <boxGeometry args={[0.8, 0.9, 0.8]} />
      </mesh>
    </group>
  );
}

function Site({ bounds, mats, xray }: { bounds: SceneBounds; mats: Mats; xray: boolean }) {
  const w = bounds.maxX - bounds.minX + 7;
  const d = bounds.maxZ - bounds.minZ + 7;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const trees = React.useMemo(() => {
    const pts: [number, number, number][] = [];
    const ex = w / 2 + 8;
    const ez = d / 2 + 8;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(i) * 0.2;
      const r = 1 + rand(i + 9) * 0.12;
      pts.push([cx + Math.cos(a) * ex * r, cz + Math.sin(a) * ez * r, 0.8 + rand(i + 3) * 0.6]);
    }
    return pts;
  }, [w, d, cx, cz]);
  const treeGeo = React.useMemo(() => new THREE.IcosahedronGeometry(1.9, 0), []);
  const trunkGeo = React.useMemo(() => new THREE.CylinderGeometry(0.18, 0.26, 2.4, 6), []);
  React.useEffect(
    () => () => {
      treeGeo.dispose();
      trunkGeo.dispose();
    },
    [treeGeo, trunkGeo],
  );

  return (
    <group>
      <mesh position={[cx, PLINTH_H / 2, cz]} material={mats.stone} castShadow receiveShadow>
        <boxGeometry args={[w, PLINTH_H, d]} />
      </mesh>
      <mesh position={[cx, PLINTH_H * 0.33, cz + d / 2 + 0.9]} material={mats.stone} receiveShadow>
        <boxGeometry args={[Math.min(w * 0.4, 14), PLINTH_H * 0.66, 1.8]} />
      </mesh>
      <mesh position={[cx, 0.03, cz]} material={mats.paving} receiveShadow>
        <boxGeometry args={[w + 28, 0.06, d + 28]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={mats.ground} receiveShadow>
        <circleGeometry args={[Math.max(w, d) * 7 + 120, 64]} />
      </mesh>
      {!xray &&
        trees.map(([x, z, s], i) => (
          <group key={i} position={[x, 0, z]} scale={s}>
            <mesh geometry={trunkGeo} material={mats.trunk} position={[0, 1.2, 0]} castShadow />
            <mesh geometry={treeGeo} material={mats.tree} position={[0, 3.2, 0]} castShadow />
          </group>
        ))}
    </group>
  );
}

export function ProceduralBuilding({
  blocks,
  bounds,
  progress,
  showProgress,
  look,
  explode,
  isolate,
  floorLabel,
}: {
  blocks: Block[];
  bounds: SceneBounds;
  progress: number;
  showProgress: boolean;
  look: Look;
  explode: number;
  isolate: number;
  floorLabel: (n: number) => string;
}) {
  const mats = useMaterials(look);
  const invalidate = useThree((s) => s.invalidate);
  const registry = React.useMemo<Registry>(() => ({ items: new Map(), value: 0 }), []);

  React.useEffect(() => invalidate(), [explode, invalidate]);

  useFrame((_, dt) => {
    const cur = registry.value;
    if (cur === explode) return;
    const next = Math.abs(explode - cur) < 0.002 ? explode : THREE.MathUtils.damp(cur, explode, 7, Math.min(dt, 0.05));
    registry.value = next;
    registry.items.forEach((r) => (r.g.position.y = r.baseY + (r.k - 1) * next * EXPLODE_GAP));
    invalidate();
  });

  const underConstruction = showProgress && progress > 0 && progress < 100;
  return (
    <group>
      <Site bounds={bounds} mats={mats} xray={look.xray} />
      {blocks.map((b, i) => (
        <BlockMesh
          key={b.key}
          block={b}
          index={i}
          progress={progress}
          showProgress={showProgress}
          isolate={isolate}
          look={look}
          mats={mats}
          registry={registry}
          floorLabel={floorLabel}
        />
      ))}
      {underConstruction && <Crane x={bounds.maxX + 6} z={bounds.minZ + 3} height={bounds.height + 4} mats={mats} />}
    </group>
  );
}
