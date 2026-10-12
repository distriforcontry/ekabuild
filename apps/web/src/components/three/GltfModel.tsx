"use client";
import * as React from "react";
import * as THREE from "three";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { EXPLODE_GAP } from "./massing";

/** Models whose largest dimension falls outside this range (metres) are rescaled to TARGET. */
const PLAUSIBLE: [number, number] = [4, 800];
const TARGET = 60;

type FloorNode = { n: number; obj: THREE.Object3D; baseY: number; unit: number };

const FLOOR_RE = /^floor[-_ ]?(\d+)$/i;

/**
 * Uploaded GLB/GLTF model. Units are expected in metres (Y-up); implausible scales are normalised.
 * If the scene follows the EKA naming convention (`site`, `podium`, `floor-<n>`, `roof`) the floors can be
 * exploded and isolated just like the procedural building; otherwise those features are simply unavailable.
 */
export function GltfModel({
  url,
  xray,
  explode,
  isolate,
  floorLabel,
  onBounds,
  onFloors,
}: {
  url: string;
  xray: boolean;
  explode: number;
  isolate: number;
  floorLabel: (n: number) => string;
  onBounds: (box: THREE.Box3) => void;
  onFloors: (count: number) => void;
}) {
  // The Draco decoder is only fetched if the file is actually Draco-compressed.
  const { scene } = useGLTF(url, true);
  const invalidate = useThree((s) => s.invalidate);

  const prepared = React.useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.__orig = m.material;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    const s = max >= PLAUSIBLE[0] && max <= PLAUSIBLE[1] ? 1 : TARGET / Math.max(max, 0.001);
    root.scale.multiplyScalar(s);
    box.setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x;
    root.position.z -= c.z;
    root.position.y -= box.min.y;
    root.updateMatrixWorld(true);

    // naming convention
    const floors: FloorNode[] = [];
    const found: { roof: { obj: THREE.Object3D; baseY: number; unit: number } | null; site: THREE.Object3D | null } = {
      roof: null,
      site: null,
    };
    const ws = new THREE.Vector3();
    root.traverse((o) => {
      const f = FLOOR_RE.exec(o.name);
      if (f && !floors.some((x) => x.obj === o || isAncestor(x.obj, o))) {
        o.parent?.getWorldScale(ws);
        floors.push({ n: Number(f[1]), obj: o, baseY: o.position.y, unit: 1 / (ws.y || 1) });
      } else if (!found.roof && /^roof$/i.test(o.name)) {
        o.parent?.getWorldScale(ws);
        found.roof = { obj: o, baseY: o.position.y, unit: 1 / (ws.y || 1) };
      } else if (!found.site && /^site$/i.test(o.name)) found.site = o;
    });
    floors.sort((a, b) => a.n - b.n);

    // tag meshes with their owner (floor number / "site" / other)
    for (const f of floors) f.obj.traverse((o) => (o.userData.__floor = f.n));
    found.site?.traverse((o) => (o.userData.__site = true));

    // frame the building, not the whole plaza
    const frame = new THREE.Box3();
    if (found.site) {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !m.userData.__site) frame.expandByObject(m);
      });
    }
    return { root, floors, roof: found.roof, frame: frame.isEmpty() ? new THREE.Box3().setFromObject(root) : frame };
  }, [scene]);

  const { root, floors, roof } = prepared;

  React.useEffect(() => {
    onBounds(prepared.frame.clone());
    onFloors(floors.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  // materials: x-ray + floor isolation
  const dimMat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: "#9fb2c4", transparent: true, opacity: 0.06, depthWrite: false }), []);
  const siteDim = React.useMemo(() => new THREE.MeshBasicMaterial({ color: "#8a8478", transparent: true, opacity: 0.25, depthWrite: false }), []);
  React.useEffect(
    () => () => {
      dimMat.dispose();
      siteDim.dispose();
    },
    [dimMat, siteDim],
  );

  React.useEffect(() => {
    const active = isolate > 0 && floors.length > 0;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const orig = m.userData.__orig as THREE.Material | THREE.Material[];
      (Array.isArray(orig) ? orig : [orig]).forEach((mat) => {
        const mm = mat as THREE.MeshStandardMaterial;
        if (mm.userData.__base === undefined) mm.userData.__base = { opacity: mm.opacity, transparent: mm.transparent };
        mm.wireframe = xray;
        mm.transparent = xray ? true : mm.userData.__base.transparent;
        mm.opacity = xray ? 0.35 : mm.userData.__base.opacity;
        mm.needsUpdate = true;
      });
      if (active && m.userData.__floor !== isolate) m.material = m.userData.__site ? siteDim : dimMat;
      else m.material = orig;
    });
    invalidate();
  }, [root, floors.length, xray, isolate, dimMat, siteDim, invalidate]);

  // explode animation
  const cur = React.useRef(0);
  React.useEffect(() => invalidate(), [explode, invalidate]);
  useFrame((_, dt) => {
    if (!floors.length || cur.current === explode) return;
    const next = Math.abs(explode - cur.current) < 0.002 ? explode : THREE.MathUtils.damp(cur.current, explode, 7, Math.min(dt, 0.05));
    cur.current = next;
    for (const f of floors) f.obj.position.y = f.baseY + (f.n - 1) * next * EXPLODE_GAP * f.unit;
    if (roof) roof.obj.position.y = roof.baseY + floors.length * next * EXPLODE_GAP * roof.unit;
    invalidate();
  });

  // floor label anchored to the isolated floor (moves with explode)
  const labelTarget = React.useMemo(() => {
    const f = floors.find((x) => x.n === isolate);
    if (!f) return null;
    f.obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(f.obj);
    if (b.isEmpty()) return null;
    const corner = new THREE.Vector3(b.max.x + 1.2, (b.min.y + b.max.y) / 2, b.max.z + 1.2);
    return { obj: f.obj, pos: f.obj.worldToLocal(corner) };
  }, [floors, isolate]);

  return (
    <>
      <primitive object={root} />
      {labelTarget &&
        createPortal(
          <Html position={labelTarget.pos} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded-full bg-gold-gradient px-3 py-1 font-mono text-xs font-bold text-onyx shadow-glow">
              {floorLabel(isolate)}
            </div>
          </Html>,
          labelTarget.obj,
        )}
    </>
  );
}

function isAncestor(a: THREE.Object3D, b: THREE.Object3D) {
  let p = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}
