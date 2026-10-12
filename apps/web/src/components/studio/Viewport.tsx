"use client";
// The WebGL viewport of the studio: cameras, lights/HDRI, grid + view cube, model, selection/hover overlays,
// section plane + fill, measurements, planar areas, pins and the transform gizmo. Rendering is on demand.
import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  GizmoHelper,
  GizmoViewcube,
  Grid,
  Html,
  Line,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import { useTheme } from "next-themes";
import { useStudio, useS } from "./context";
import { Store, useStoreValue, type Vec3, type ViewName, type Measure, type AreaMeasure, type Pin } from "./store";
import { fmtM, fmtM2, isLocked, isShown, planarRegion, renderablesUnder, uid, worldBox } from "./scene-utils";

type OrbitImpl = React.ComponentRef<typeof OrbitControls>;
type TCImpl = React.ComponentRef<typeof TransformControls>;

type Live = {
  cursor: { point: Vec3; normal: Vec3; snapped: boolean } | null;
  pending: Vec3 | null;
};
const LiveContext = React.createContext<Store<Live> | null>(null);
const useLive = () => React.useContext(LiveContext)!;

export const VIEW_DIRS: Record<ViewName, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0.0001, 1),
  back: new THREE.Vector3(0, 0.0001, -1),
  top: new THREE.Vector3(0, 1, 0.0001),
  right: new THREE.Vector3(1, 0.0001, 0),
  left: new THREE.Vector3(-1, 0.0001, 0),
  iso: new THREE.Vector3(1, 0.72, 1.15),
};

const GOLD = "#c9a464";

const v3 = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);
const arr = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

export type ViewportLabels = {
  faces: string[];
  pin: (n: number) => string;
  untitledPin: string;
  noWebgl: string;
};

// ───────────────────────────── bridge & cameras ─────────────────────────────

function Bridge() {
  const { engine } = useStudio();
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  React.useEffect(() => {
    engine.invalidate = () => invalidate();
    engine.canvas = gl.domElement;
    gl.localClippingEnabled = true;
    invalidate();
    if (process.env.NODE_ENV !== "production") (window as unknown as { __ekaStudio?: unknown }).__ekaStudio = { engine, gl };
    return () => {
      engine.invalidate = () => {};
      engine.canvas = null;
    };
  }, [engine, invalidate, gl]);
  const last = React.useRef(0);
  useFrame(() => {
    if (process.env.NODE_ENV === "production" || !(window as unknown as { __ekaDebug?: boolean }).__ekaDebug) return;
    const now = performance.now();
    console.warn(`[studio] frame ${gl.info.render.frame} +${Math.round(now - last.current)}ms calls=${gl.info.render.calls} tris=${gl.info.render.triangles} progs=${gl.info.programs?.length} anim=${engine.camAnimating}`);
    last.current = now;
  });
  return null;
}

function Cameras() {
  const { engine } = useStudio();
  const projection = useS((s) => s.projection);
  useS((s) => s.version);
  const r = engine.bounds.radius;
  const init = React.useCallback(
    (c: THREE.Camera | null) => {
      if (!c || c.userData.__init) return;
      c.userData.__init = true;
      c.position.copy(engine.camView.pos);
      c.lookAt(engine.camView.target);
    },
    [engine],
  );
  return projection === "perspective" ? (
    <PerspectiveCamera ref={init} makeDefault fov={38} near={Math.max(0.01, r / 3000)} far={Math.max(2000, r * 120)} />
  ) : (
    <OrthographicCamera ref={init} makeDefault near={-r * 60} far={r * 60} zoom={engine.camView.zoom} />
  );
}

function Controls() {
  const { engine } = useStudio();
  const ref = React.useRef<OrbitImpl | null>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // carry the pose over a projection switch (drei recreates OrbitControls per camera)
  React.useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { pos, target } = engine.camView;
    c.target.copy(target);
    const dir = pos.clone().sub(target);
    const dist = Math.max(0.01, dir.length());
    dir.normalize();
    const fov = (38 * Math.PI) / 180;
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      oc.zoom = Math.max(0.0001, size.height / (2 * dist * Math.tan(fov / 2)));
      oc.position.copy(target).addScaledVector(dir, Math.max(dist, engine.bounds.radius * 3));
      oc.updateProjectionMatrix();
    } else {
      const d = engine.camView.ortho ? size.height / (2 * Math.max(0.0001, engine.camView.zoom) * Math.tan(fov / 2)) : dist;
      camera.position.copy(target).addScaledVector(dir, d);
    }
    camera.lookAt(target);
    c.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);
  const r = engine.bounds.radius;
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning
      zoomToCursor
      minDistance={Math.max(0.05, r / 400)}
      maxDistance={r * 40}
      onStart={() => {
        engine.camAnimating = false;
      }}
      onChange={() => {
        const c = ref.current;
        if (!c) return;
        engine.camView.pos.copy(c.object.position);
        engine.camView.target.copy(c.target);
        const oc = c.object as THREE.OrthographicCamera;
        engine.camView.ortho = Boolean(oc.isOrthographicCamera);
        if (oc.isOrthographicCamera) engine.camView.zoom = oc.zoom;
      }}
    />
  );
}

function CameraRig() {
  const { engine, store } = useStudio();
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const { resolvedTheme } = useTheme();
  const version = useS((s) => s.version);
  const goal = React.useRef<{ pos: THREE.Vector3; target: THREE.Vector3; zoom: number | null } | null>(null);

  React.useEffect(() => {
    const api = {
      fit(box?: THREE.Box3 | null, opts?: { view?: ViewName; instant?: boolean }) {
        const { camera, controls, size } = get();
        const ctl = controls as unknown as OrbitImpl | null;
        const b = box && !box.isEmpty() ? box : engine.bounds.frame;
        const center = b.getCenter(new THREE.Vector3());
        const radius = Math.max(0.3, b.getSize(new THREE.Vector3()).length() / 2);
        const curTarget = ctl?.target ?? engine.camView.target;
        let dir = opts?.view ? VIEW_DIRS[opts.view].clone().normalize() : camera.position.clone().sub(curTarget).normalize();
        if (!Number.isFinite(dir.x) || dir.lengthSq() < 0.5) dir = VIEW_DIRS.iso.clone().normalize();
        const aspect = size.width / Math.max(1, size.height);
        let pos: THREE.Vector3;
        let zoom: number | null = null;
        if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
          zoom = Math.min(size.width, size.height) / (radius * 2.25);
          pos = center.clone().addScaledVector(dir, radius * 4);
        } else {
          const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
          const hfov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
          const dist = (radius / Math.sin(Math.min(fov, hfov) / 2)) * 1.04;
          pos = center.clone().addScaledVector(dir, dist);
        }
        goal.current = { pos, target: center, zoom };
        engine.camAnimating = true;
        if (opts?.instant) {
          camera.position.copy(pos);
          if (ctl) ctl.target.copy(center);
          if (zoom) {
            (camera as THREE.OrthographicCamera).zoom = zoom;
            (camera as THREE.OrthographicCamera).updateProjectionMatrix();
          }
          camera.lookAt(center);
          ctl?.update();
          goal.current = null;
          engine.camAnimating = false;
        }
        invalidate();
      },
      view(name: ViewName) {
        const sel = engine.get(store.get().selection);
        api.fit(sel ? worldBox(sel) : engine.bounds.frame, { view: name });
      },
      focus(point: THREE.Vector3, distance?: number) {
        const { camera, controls } = get();
        const ctl = controls as unknown as OrbitImpl | null;
        const dir = camera.position.clone().sub(ctl?.target ?? engine.camView.target).normalize();
        const d = distance ?? Math.max(4, engine.bounds.radius * 0.35);
        goal.current = { pos: point.clone().addScaledVector(dir, d), target: point.clone(), zoom: null };
        engine.camAnimating = true;
        invalidate();
      },
      async screenshot(notes: { measures: Measure[]; areas: AreaMeasure[]; pins: Pin[] }) {
        const { gl, scene, camera } = get();
        const prev = gl.getPixelRatio();
        const hidden: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if (o.userData.__helper && o.visible) {
            o.visible = false;
            hidden.push(o);
          }
        });
        try {
          gl.setPixelRatio(2);
          gl.render(scene, camera);
          const src = gl.domElement;
          const c = document.createElement("canvas");
          c.width = src.width;
          c.height = src.height;
          const ctx = c.getContext("2d");
          if (!ctx) return null;
          if (!store.get().envBackground) {
            const night = resolvedTheme !== "light";
            const g = ctx.createLinearGradient(0, 0, 0, c.height);
            g.addColorStop(0, night ? "#1b1d23" : "#f7f5f0");
            g.addColorStop(1, night ? "#0c0d10" : "#e2dccf");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, c.width, c.height);
          }
          ctx.drawImage(src, 0, 0);
          // burn annotations in
          const project = (p: THREE.Vector3) => {
            const v = p.clone().project(camera);
            return { x: ((v.x + 1) / 2) * c.width, y: ((1 - v.y) / 2) * c.height, ok: v.z < 1 && v.z > -1 };
          };
          const pill = (x: number, y: number, text: string, gold = false) => {
            ctx.font = `600 ${22}px "JetBrains Mono Variable", ui-monospace, monospace`;
            const w = ctx.measureText(text).width + 22;
            const h = 34;
            ctx.fillStyle = gold ? "#c9a464" : "rgba(17,18,21,0.88)";
            ctx.beginPath();
            ctx.roundRect(x - w / 2, y - h / 2, w, h, 9);
            ctx.fill();
            ctx.fillStyle = gold ? "#121214" : "#f4f1ea";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x, y + 1);
          };
          for (const m of notes.measures) {
            const a = project(v3(m.a));
            const b = project(v3(m.b));
            if (!a.ok || !b.ok) continue;
            pill((a.x + b.x) / 2, (a.y + b.y) / 2, fmtM(v3(m.a).distanceTo(v3(m.b))));
          }
          for (const ar of notes.areas) {
            const p = project(v3(ar.point));
            if (p.ok) pill(p.x, p.y, fmtM2(ar.area));
          }
          for (const pin of notes.pins) {
            const p = project(v3(pin.position));
            if (p.ok) pill(p.x, p.y - 26, String(pin.n), true);
          }
          ctx.font = `600 20px "Manrope Variable", ui-sans-serif, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = resolvedTheme !== "light" ? "rgba(224,194,133,0.85)" : "rgba(128,97,51,0.9)";
          ctx.fillText("EKA BUILD · 3D Studio", 28, c.height - 28);
          return await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
        } finally {
          hidden.forEach((o) => (o.visible = true));
          gl.setPixelRatio(prev);
          invalidate();
        }
      },
    };
    engine.cam = api;
    return () => {
      if (engine.cam === api) engine.cam = null;
    };
  }, [engine, store, get, invalidate, resolvedTheme]);

  // frame the freshly loaded model
  React.useEffect(() => {
    if (!engine.pendingFit || !engine.root) return;
    engine.pendingFit = false;
    const { camera, controls } = get();
    const ctl = controls as unknown as OrbitImpl | null;
    // start a bit further out, then glide in
    const b = engine.bounds.frame;
    const c = b.getCenter(new THREE.Vector3());
    const r = Math.max(1, b.getSize(new THREE.Vector3()).length() / 2);
    camera.position.copy(c).addScaledVector(VIEW_DIRS.iso.clone().normalize(), r * 5);
    if (ctl) ctl.target.copy(c);
    camera.lookAt(c);
    ctl?.update();
    engine.cam?.fit(b, { view: "iso" });
  }, [version, engine, get]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    if (!engine.camAnimating) {
      goal.current = null;
      return;
    }
    const { camera, controls } = get();
    const ctl = controls as unknown as OrbitImpl | null;
    const k = 1 - Math.exp(-7 * Math.min(dt, 0.05));
    const target = ctl?.target ?? engine.camView.target;
    // interpolate around the target (avoids flying through the model on view switches)
    const off = camera.position.clone().sub(target);
    const goalOff = g.pos.clone().sub(g.target);
    const d0 = off.length();
    const d1 = goalOff.length();
    const dirA = off.normalize();
    const dirB = goalOff.normalize();
    if (dirA.dot(dirB) < -0.98) dirA.add(new THREE.Vector3(0, 0.3, 0)).normalize();
    const dir = dirA.lerp(dirB, k).normalize();
    target.lerp(g.target, k);
    camera.position.copy(target).addScaledVector(dir, THREE.MathUtils.lerp(d0, d1, k));
    if (g.zoom && (camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      oc.zoom = THREE.MathUtils.lerp(oc.zoom, g.zoom, k);
      oc.updateProjectionMatrix();
    }
    camera.lookAt(target);
    ctl?.update();
    if (camera.position.distanceTo(g.pos) < Math.max(0.01, d1 * 0.002) && target.distanceTo(g.target) < Math.max(0.01, d1 * 0.002)) {
      goal.current = null;
      engine.camAnimating = false;
    }
    invalidate();
  });
  return null;
}

// ───────────────────────────── lights ─────────────────────────────

class Silent extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Lighting() {
  const { engine } = useStudio();
  const env = useS((s) => s.env);
  const intensity = useS((s) => s.envIntensity);
  const bg = useS((s) => s.envBackground);
  const az = useS((s) => s.sunAzimuth);
  const el = useS((s) => s.sunElevation);
  const sun = useS((s) => s.sunIntensity);
  const shadows = useS((s) => s.shadows);
  useS((s) => s.version);
  const invalidate = useThree((s) => s.invalidate);
  const { center, radius, box } = engine.bounds;
  const r = Math.max(10, radius);
  const azr = THREE.MathUtils.degToRad(az);
  const elr = THREE.MathUtils.degToRad(el);
  const pos = new THREE.Vector3(Math.cos(elr) * Math.sin(azr), Math.sin(elr), Math.cos(elr) * Math.cos(azr)).multiplyScalar(r * 2.5).add(center);
  const setup = React.useCallback(
    (l: THREE.DirectionalLight | null) => {
      if (!l) return;
      l.shadow.mapSize.set(2048, 2048);
      const c = l.shadow.camera;
      c.left = -r * 1.15;
      c.right = r * 1.15;
      c.top = r * 1.15;
      c.bottom = -r * 1.15;
      c.near = r * 0.2;
      c.far = r * 6;
      c.updateProjectionMatrix();
      l.shadow.bias = -0.0003;
      l.shadow.normalBias = Math.max(0.02, r / 2500);
      l.target.position.copy(center);
      l.target.updateMatrixWorld();
      l.shadow.needsUpdate = true;
      invalidate();
    },
    [r, center, invalidate],
  );
  const night = env === "night";
  return (
    <>
      <hemisphereLight args={[night ? "#3a4566" : "#eef3fb", night ? "#0b0b0e" : "#5b5143", env === "none" ? 1.1 : night ? 0.35 : 0.5]} />
      <ambientLight intensity={env === "none" ? 0.35 : 0.12} />
      <directionalLight
        ref={setup}
        position={pos}
        intensity={night ? sun * 0.35 : sun}
        color={night ? "#b4c4ff" : el < 18 ? "#ffd4a3" : "#fff3e2"}
        castShadow={shadows}
      />
      {env !== "none" && (
        <Silent key={env}>
          <React.Suspense fallback={null}>
            <Environment files={`/hdri/${env}.exr`} environmentIntensity={intensity} background={bg} backgroundBlurriness={0.35} />
          </React.Suspense>
        </Silent>
      )}
      {shadows && (
        <mesh rotation-x={-Math.PI / 2} position={[center.x, box.min.y + 0.005, center.z]} receiveShadow userData={{ __helper: false }} raycast={() => null}>
          <planeGeometry args={[r * 8, r * 8]} />
          <shadowMaterial transparent opacity={night ? 0.5 : 0.22} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

// ───────────────────────────── helpers: grid & gizmo ─────────────────────────────

function GridFloor() {
  const { engine } = useStudio();
  const on = useS((s) => s.grid);
  useS((s) => s.version);
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  const ref = React.useCallback((m: THREE.Mesh | null) => {
    if (m) {
      m.userData.__helper = true;
      m.raycast = () => null;
    }
  }, []);
  if (!on) return null;
  const { box, radius } = engine.bounds;
  const big = radius > 300;
  return (
    <Grid
      ref={ref}
      position={[0, box.min.y - 0.02, 0]}
      args={[10, 10]}
      infiniteGrid
      cellSize={big ? 10 : 1}
      sectionSize={big ? 100 : 10}
      cellThickness={0.6}
      sectionThickness={1.1}
      cellColor={light ? "#cfc8ba" : "#2c2e35"}
      sectionColor={light ? "#b08a4e" : "#6b522d"}
      fadeDistance={Math.max(80, radius * 7)}
      fadeStrength={1.4}
      followCamera={false}
    />
  );
}

function ViewGizmo({ faces }: { faces: string[] }) {
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  return (
    <GizmoHelper alignment="bottom-right" margin={[74, 74]}>
      <GizmoViewcube
        faces={faces}
        color={light ? "#ffffff" : "#1c1d22"}
        hoverColor={GOLD}
        textColor={light ? "#2a2924" : "#e4e5e9"}
        strokeColor={light ? "#cdc7bb" : "#4a4d56"}
        opacity={0.96}
        font="600 18px Manrope Variable, sans-serif"
      />
    </GizmoHelper>
  );
}

// ───────────────────────────── proxies (selection / hover / section fill) ─────────────────────────────

function ProxyLayer({ meshes, material, order }: { meshes: THREE.Mesh[]; material: THREE.Material; order: number }) {
  const group = React.useMemo(() => {
    const g = new THREE.Group();
    g.userData.__helper = true;
    return g;
  }, []);
  const invalidate = useThree((s) => s.invalidate);
  React.useLayoutEffect(() => {
    group.clear();
    for (const m of meshes) {
      let p: THREE.Mesh;
      if ((m as THREE.InstancedMesh).isInstancedMesh) {
        const im = m as THREE.InstancedMesh;
        const pi = new THREE.InstancedMesh(im.geometry, material, im.count);
        pi.instanceMatrix = im.instanceMatrix;
        p = pi;
      } else p = new THREE.Mesh(m.geometry, material);
      p.matrixAutoUpdate = false;
      p.matrixWorldAutoUpdate = false;
      p.matrixWorld.copy(m.matrixWorld);
      p.renderOrder = order;
      p.raycast = () => null;
      p.userData.__src = m;
      p.frustumCulled = false;
      group.add(p);
    }
    invalidate();
    return () => {
      group.clear();
    };
  }, [meshes, material, group, order, invalidate]);
  useFrame(() => {
    for (const p of group.children) {
      const src = p.userData.__src as THREE.Mesh;
      p.matrixWorld.copy(src.matrixWorld);
      p.visible = src.layers.isEnabled(0);
    }
  });
  return <primitive object={group} />;
}

function useOverlayMaterial(opts: THREE.MeshBasicMaterialParameters) {
  const { engine } = useStudio();
  const section = useS((s) => s.section.enabled);
  const mat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        depthFunc: THREE.LessEqualDepth,
        ...opts,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  React.useEffect(() => () => mat.dispose(), [mat]);
  React.useEffect(() => {
    mat.clippingPlanes = section ? [engine.plane] : null;
    mat.needsUpdate = true;
    engine.invalidate();
  }, [section, mat, engine]);
  return mat;
}

function SelectionOverlay() {
  const { engine } = useStudio();
  const selection = useS((s) => s.selection);
  const hover = useS((s) => s.hover);
  const version = useS((s) => s.version);
  const isolated = useS((s) => s.isolated);
  const tool = useS((s) => s.tool);
  const selMat = useOverlayMaterial({ color: GOLD, opacity: 0.32 });
  const hovMat = useOverlayMaterial({ color: "#f4e9d2", opacity: 0.16 });
  const selMeshes = React.useMemo(() => {
    const o = engine.get(selection);
    return o ? renderablesUnder(o, true, engine.root) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selection, version, isolated]);
  const hovMeshes = React.useMemo(() => {
    if (tool !== "select" || !hover || hover === selection) return [];
    const o = engine.get(hover);
    return o ? renderablesUnder(o, true, engine.root) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, hover, selection, version, tool]);

  // gold bounding box around the selection
  const helper = React.useMemo(() => {
    const h = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(GOLD));
    h.userData.__helper = true;
    h.raycast = () => null;
    (h.material as THREE.LineBasicMaterial).depthTest = false;
    (h.material as THREE.LineBasicMaterial).transparent = true;
    (h.material as THREE.LineBasicMaterial).opacity = 0.9;
    h.renderOrder = 20;
    return h;
  }, []);
  useFrame(() => {
    const o = engine.get(selection);
    if (!o) {
      helper.visible = false;
      return;
    }
    const b = worldBox(o, true, engine.root);
    helper.visible = !b.isEmpty();
    helper.box.copy(b);
  });
  return (
    <>
      {selMeshes.length > 0 && <ProxyLayer meshes={selMeshes} material={selMat} order={5} />}
      {hovMeshes.length > 0 && <ProxyLayer meshes={hovMeshes} material={hovMat} order={4} />}
      {selection && <primitive object={helper} />}
    </>
  );
}

function SectionFill() {
  const { engine } = useStudio();
  const enabled = useS((s) => s.section.enabled);
  const fill = useS((s) => s.section.fill);
  const version = useS((s) => s.version);
  const isolated = useS((s) => s.isolated);
  const { resolvedTheme } = useTheme();
  const mat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        color: "#c9a464",
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [],
  );
  React.useEffect(() => () => mat.dispose(), [mat]);
  React.useEffect(() => {
    mat.color.set(resolvedTheme === "light" ? "#b9935a" : "#8e6e3c");
    mat.clippingPlanes = [engine.plane];
    mat.needsUpdate = true;
    engine.invalidate();
  }, [mat, engine, resolvedTheme]);
  const meshes = React.useMemo(
    () => (enabled && fill && engine.root ? renderablesUnder(engine.root, true, engine.root) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, fill, engine, version, isolated],
  );
  if (!meshes.length) return null;
  return <ProxyLayer meshes={meshes} material={mat} order={1} />;
}

function SectionPlaneHelper() {
  const { engine } = useStudio();
  const s = useS((st) => st.section);
  useS((st) => st.version);
  if (!s.enabled || !s.showPlane) return null;
  const box = engine.bounds.box;
  const size = box.getSize(new THREE.Vector3()).multiplyScalar(1.08);
  const c = box.getCenter(new THREE.Vector3());
  const pos = engine.sectionPosition();
  let w = size.x,
    h = size.y;
  const p = c.clone();
  const rot = new THREE.Euler();
  if (s.axis === "x") {
    p.x = pos;
    w = size.z;
    h = size.y;
    rot.set(0, Math.PI / 2, 0);
  } else if (s.axis === "y") {
    p.y = pos;
    w = size.x;
    h = size.z;
    rot.set(-Math.PI / 2, 0, 0);
  } else {
    p.z = pos;
    w = size.x;
    h = size.y;
  }
  const hw = w / 2,
    hh = h / 2;
  return (
    <group position={p} rotation={rot} userData={{ __helper: true }}>
      <mesh raycast={() => null} renderOrder={2}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line
        points={[
          [-hw, -hh, 0],
          [hw, -hh, 0],
          [hw, hh, 0],
          [-hw, hh, 0],
          [-hw, -hh, 0],
        ]}
        color={GOLD}
        lineWidth={1.5}
        transparent
        opacity={0.85}
        dashed
        dashSize={Math.max(0.5, w / 60)}
        gapSize={Math.max(0.3, w / 120)}
      />
    </group>
  );
}

// ───────────────────────────── transform gizmo ─────────────────────────────

function Transform({ tcRef }: { tcRef: React.MutableRefObject<TCImpl | null> }) {
  const { engine, store } = useStudio();
  const selection = useS((s) => s.selection);
  const mode = useS((s) => s.transform);
  const space = useS((s) => s.space);
  const snap = useS((s) => s.snap);
  useS((s) => s.version);
  const obj = engine.get(selection);
  const raf = React.useRef(0);
  const setRef = React.useCallback(
    (tc: TCImpl | null) => {
      tcRef.current = tc;
      if (tc) {
        (tc as unknown as THREE.Object3D).userData.__helper = true;
      }
    },
    [tcRef],
  );
  if (!obj || !mode || isLocked(obj, engine.root)) return null;
  return (
    <TransformControls
      ref={setRef}
      object={obj}
      mode={mode}
      space={space}
      size={0.85}
      translationSnap={snap ? 0.25 : null}
      rotationSnap={snap ? THREE.MathUtils.degToRad(15) : null}
      scaleSnap={snap ? 0.05 : null}
      onMouseDown={() => engine.beginTransform(obj)}
      onMouseUp={() => engine.endTransform(obj)}
      onObjectChange={() => {
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => store.set((s) => ({ tick: s.tick + 1 })));
      }}
    />
  );
}

// ───────────────────────────── interaction ─────────────────────────────

function Interaction({ tcRef }: { tcRef: React.MutableRefObject<TCImpl | null> }) {
  const { engine, store } = useStudio();
  const live = useLive();
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);

  React.useEffect(() => {
    const el = gl.domElement;
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.05 };
    const nm = new THREE.Matrix3();

    const pick = (e: PointerEvent | MouseEvent, forSelect: boolean) => {
      const root = engine.root;
      if (!root) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const { camera } = get();
      raycaster.setFromCamera(ndc, camera);
      raycaster.layers.set(0);
      const hits = raycaster.intersectObject(root, true);
      const s = store.get();
      for (const h of hits) {
        if (!isShown(h.object, root)) continue;
        if (s.section.enabled && engine.plane.distanceToPoint(h.point) < -1e-4) continue;
        if (forSelect && isLocked(h.object, root)) continue;
        const mm = (h.object as THREE.Mesh).material;
        const mat = Array.isArray(mm) ? mm[h.face?.materialIndex ?? 0] : mm;
        if (mat && !mat.visible) continue;
        return h;
      }
      return null;
    };

    const normalOf = (h: THREE.Intersection): THREE.Vector3 => {
      if (!h.face) return new THREE.Vector3(0, 1, 0);
      nm.getNormalMatrix(h.object.matrixWorld);
      const n = h.face.normal.clone().applyMatrix3(nm).normalize();
      const { camera } = get();
      // face the camera
      if (n.dot(camera.position.clone().sub(h.point)) < 0) n.negate();
      return n;
    };

    const snapPoint = (h: THREE.Intersection, e: PointerEvent | MouseEvent) => {
      const mesh = h.object as THREE.Mesh;
      if (!h.face || !mesh.geometry || (mesh as THREE.InstancedMesh).isInstancedMesh) return { p: h.point.clone(), snapped: false };
      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const vs = [h.face.a, h.face.b, h.face.c].map((i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
      const cands = [...vs, vs[0]!.clone().lerp(vs[1]!, 0.5), vs[1]!.clone().lerp(vs[2]!, 0.5), vs[2]!.clone().lerp(vs[0]!, 0.5)];
      const { camera } = get();
      const r = el.getBoundingClientRect();
      let best: THREE.Vector3 | null = null;
      let bestD = 14;
      for (const c of cands) {
        const v = c.clone().project(camera);
        const x = ((v.x + 1) / 2) * r.width + r.left;
        const y = ((1 - v.y) / 2) * r.height + r.top;
        const d = Math.hypot(x - e.clientX, y - e.clientY);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best ? { p: best, snapped: true } : { p: h.point.clone(), snapped: false };
    };

    let down: { x: number; y: number; t: number; gizmo: boolean } | null = null;
    let raf = 0;
    let lastMove: PointerEvent | null = null;

    const hover = () => {
      raf = 0;
      const e = lastMove;
      if (!e) return;
      const s = store.get();
      if (e.buttons) return; // orbiting
      if (s.tool === "select") {
        const h = pick(e, true);
        const target = h ? engine.pickTarget(h.object) : null;
        const uuid = target?.uuid ?? null;
        if (s.hover !== uuid) store.set({ hover: uuid });
        el.style.cursor = h ? "pointer" : "default";
        if (live.get().cursor) live.set({ cursor: null });
        return;
      }
      el.style.cursor = "crosshair";
      const h = pick(e, false);
      if (!h) {
        if (live.get().cursor) live.set({ cursor: null });
        engine.invalidate();
        return;
      }
      const sp = s.tool === "measure" ? snapPoint(h, e) : { p: h.point, snapped: false };
      live.set({ cursor: { point: arr(sp.p), normal: arr(normalOf(h)), snapped: sp.snapped } });
      engine.invalidate();
    };

    const onMove = (e: PointerEvent) => {
      lastMove = e;
      if (!raf) raf = requestAnimationFrame(hover);
    };
    const onLeave = () => {
      lastMove = null;
      if (store.get().hover) store.set({ hover: null });
      if (live.get().cursor) live.set({ cursor: null });
      engine.invalidate();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const tc = tcRef.current as unknown as { axis?: string | null } | null;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), gizmo: Boolean(tc?.axis) };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || e.button !== 0 || d.gizmo) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 600) return;
      click(e);
    };

    const click = (e: PointerEvent) => {
      const s = store.get();
      if (s.tool === "select") {
        const h = pick(e, true);
        if (!h) {
          engine.select(null);
          return;
        }
        engine.select(engine.pickTarget(h.object).uuid);
        return;
      }
      const h = pick(e, false);
      if (!h) return;
      if (s.tool === "measure") {
        const sp = snapPoint(h, e);
        const p = arr(sp.p);
        const pending = live.get().pending;
        if (!pending) live.set({ pending: p });
        else {
          const m: Measure = { id: uid(), a: pending, b: p, createdAt: Date.now() };
          live.set({ pending: null });
          store.set((st) => ({ measures: [...st.measures, m] }));
        }
      } else if (s.tool === "area") {
        if (h.faceIndex == null || !(h.object as THREE.Mesh).isMesh) return;
        const reg = planarRegion(h.object as THREE.Mesh, h.faceIndex);
        if (!reg || reg.area <= 0) return;
        const horizontal = Math.abs(reg.normal.y) > 0.95;
        const a: AreaMeasure = {
          id: uid(),
          area: reg.area,
          point: arr(reg.centroid),
          normal: arr(reg.normal),
          tris: reg.tris,
          label: horizontal ? "h" : "v",
          createdAt: Date.now(),
        };
        store.set((st) => ({ areas: [...st.areas, a] }));
      } else if (s.tool === "pin") {
        const n = normalOf(h);
        const pos = h.point.clone().addScaledVector(n, 0.04);
        const next = s.pins.reduce((m, p) => Math.max(m, p.n), 0) + 1;
        const pin: Pin = {
          id: uid(),
          n: next,
          position: arr(pos),
          normal: arr(n),
          text: "",
          target: engine.pickTarget(h.object).uuid,
          createdAt: Date.now(),
        };
        store.set((st) => ({ pins: [...st.pins, pin], activePin: pin.id, tab: "notes", rightOpen: true }));
      }
      engine.invalidate();
    };

    const onDbl = (e: MouseEvent) => {
      if (store.get().tool !== "select") return;
      const h = pick(e, true);
      if (!h) {
        engine.cam?.fit(null);
        return;
      }
      const target = engine.pickTarget(h.object);
      engine.select(target.uuid);
      engine.cam?.fit(worldBox(target, true, engine.root));
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("dblclick", onDbl);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("dblclick", onDbl);
      el.style.cursor = "";
    };
  }, [engine, store, live, get, gl, tcRef]);

  // Escape: drop a pending measurement point first, otherwise leave the tool
  const esc = useS((s) => s.esc);
  React.useEffect(() => {
    if (!esc) return;
    if (live.get().pending) {
      live.set({ pending: null });
      engine.invalidate();
    } else if (store.get().tool !== "select") store.set({ tool: "select" });
    else if (store.get().transform) store.set({ transform: null });
    else if (store.get().selection) engine.select(null);
    else if (store.get().isolated) engine.isolate(null);
  }, [esc, live, store, engine]);

  // cancel a half-made measurement when the tool changes
  const tool = useS((s) => s.tool);
  React.useEffect(() => {
    live.set({ pending: null, cursor: null });
    if (tool !== "select") store.set({ hover: null });
    engine.invalidate();
  }, [tool, live, store, engine]);
  return null;
}

// ───────────────────────────── annotations ─────────────────────────────

function Endpoint({ p, color = GOLD, size = 7 }: { p: Vec3; color?: string; size?: number }) {
  const geo = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, [p]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <points geometry={geo} renderOrder={30} raycast={() => null}>
      <pointsMaterial color={color} size={size} sizeAttenuation={false} depthTest={false} transparent />
    </points>
  );
}

function Label({ position, children, tone = "dark" }: { position: Vec3; children: React.ReactNode; tone?: "dark" | "gold" }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        className={
          tone === "gold"
            ? "whitespace-nowrap rounded-md bg-gold-gradient px-1.5 py-0.5 font-mono text-[11px] font-bold text-onyx shadow-glow"
            : "whitespace-nowrap rounded-md border border-line-strong bg-ink-900/90 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-stone-100 shadow-card backdrop-blur"
        }
      >
        {children}
      </div>
    </Html>
  );
}

function MeasureLayer() {
  const measures = useS((s) => s.measures);
  const tool = useS((s) => s.tool);
  const live = useLive();
  const cursor = useStoreValue(live, (s) => s.cursor);
  const pending = useStoreValue(live, (s) => s.pending);
  return (
    <group>
      {measures.map((m) => {
        const a = v3(m.a);
        const b = v3(m.b);
        const mid = a.clone().lerp(b, 0.5);
        return (
          <group key={m.id}>
            <Line points={[m.a, m.b]} color={GOLD} lineWidth={2} depthTest={false} renderOrder={25} transparent />
            <Endpoint p={m.a} />
            <Endpoint p={m.b} />
            <Label position={arr(mid)}>{fmtM(a.distanceTo(b))}</Label>
          </group>
        );
      })}
      {tool === "measure" && pending && <Endpoint p={pending} color="#f4e9d2" size={9} />}
      {tool === "measure" && pending && cursor && (
        <>
          <Line points={[pending, cursor.point]} color="#f4e9d2" lineWidth={1.5} dashed dashSize={0.4} gapSize={0.25} depthTest={false} renderOrder={26} transparent />
          <Label position={arr(v3(pending).lerp(v3(cursor.point), 0.5))} tone="gold">
            {fmtM(v3(pending).distanceTo(v3(cursor.point)))}
          </Label>
        </>
      )}
      {tool !== "select" && cursor && <Endpoint p={cursor.point} color={cursor.snapped ? "#3fb68b" : "#f4e9d2"} size={cursor.snapped ? 11 : 8} />}
    </group>
  );
}

function AreaShape({ a }: { a: AreaMeasure }) {
  const geo = React.useMemo(() => {
    if (!a.tris) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a.tris, 3));
    return g;
  }, [a.tris]);
  React.useEffect(() => () => geo?.dispose(), [geo]);
  return (
    <group>
      {geo && (
        <mesh geometry={geo} renderOrder={6} raycast={() => null} userData={{ __area: true }}>
          <meshBasicMaterial color={GOLD} transparent opacity={0.38} side={THREE.DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      )}
      <Label position={a.point} tone="gold">
        {fmtM2(a.area)}
      </Label>
    </group>
  );
}

function AreaLayer() {
  const areas = useS((s) => s.areas);
  return (
    <group>
      {areas.map((a) => (
        <AreaShape key={a.id} a={a} />
      ))}
    </group>
  );
}

function PinLayer({ labels }: { labels: ViewportLabels }) {
  const { store, engine } = useStudio();
  const pins = useS((s) => s.pins);
  const active = useS((s) => s.activePin);
  return (
    <group>
      {pins.map((p) => (
        <Html key={p.id} position={p.position} zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
          <div className="pointer-events-none relative -translate-x-1/2 -translate-y-full pb-1">
            <button
              type="button"
              aria-label={labels.pin(p.n)}
              onClick={() => {
                store.set({ activePin: p.id, tab: "notes", rightOpen: true });
                engine.invalidate();
              }}
              className={
                "pointer-events-auto grid size-7 cursor-pointer place-items-center rounded-full rounded-bl-none font-mono text-[11px] font-bold shadow-lift transition-transform hover:scale-110 " +
                (active === p.id ? "bg-gold-gradient text-onyx ring-2 ring-gold-300/60" : "border border-gold-500/50 bg-ink-900/95 text-gold-200")
              }
            >
              {p.n}
            </button>
            {active === p.id && (
              <div className="pointer-events-none absolute bottom-full left-8 mb-1 w-max max-w-56 rounded-lg border border-line-strong bg-ink-900/95 px-2.5 py-1.5 text-xs text-ink-100 shadow-lift backdrop-blur">
                {p.text || <span className="text-ink-400">{labels.untitledPin}</span>}
              </div>
            )}
          </div>
        </Html>
      ))}
    </group>
  );
}

// ───────────────────────────── model ─────────────────────────────

function Model() {
  const { engine } = useStudio();
  return <primitive object={engine.wrapper} />;
}

/** Re-apply display/section/explode whenever their state changes. */
function DisplaySync() {
  const { engine } = useStudio();
  const xray = useS((s) => s.xray);
  const wire = useS((s) => s.wireframe);
  const section = useS((s) => s.section);
  const loaded = useS((s) => s.loaded);
  React.useEffect(() => {
    engine.applyDisplay();
  }, [engine, xray, wire, section.enabled, loaded]);
  React.useEffect(() => {
    engine.updateSection();
  }, [engine, section.axis, section.offset, section.flip, loaded]);
  return null;
}

// ───────────────────────────── canvas ─────────────────────────────

export default function Viewport({ labels, className }: { labels: ViewportLabels; className?: string }) {
  const live = React.useMemo(() => new Store<Live>({ cursor: null, pending: null }), []);
  const tcRef = React.useRef<TCImpl | null>(null);
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      fallback={<div className="grid size-full place-items-center p-6 text-center text-sm text-ink-300">{labels.noWebgl}</div>}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      <LiveContext.Provider value={live}>
        <Bridge />
        <Cameras />
        <Controls />
        <CameraRig />
        <Lighting />
        <DisplaySync />
        <Model />
        <SectionFill />
        <SelectionOverlay />
        <SectionPlaneHelper />
        <MeasureLayer />
        <AreaLayer />
        <PinLayer labels={labels} />
        <Transform tcRef={tcRef} />
        <Interaction tcRef={tcRef} />
        <GridFloor />
        <ViewGizmo faces={labels.faces} />
      </LiveContext.Provider>
    </Canvas>
  );
}
