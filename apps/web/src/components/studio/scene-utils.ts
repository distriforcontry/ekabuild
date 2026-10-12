// Pure three.js helpers for the studio: naming, stats, floors, planar areas, disposal, formatting.
import * as THREE from "three";

export const FLOOR_RE = /^(?:floor|level|storey|qavat|etaj)[-_ ]?(\d+)$/i;

/** glTF node names are sanitised by three ("site:plaza" → "siteplaza"); the original lives in userData.name. */
export function displayName(o: THREE.Object3D): string {
  const n = (o.userData?.name as string | undefined) ?? o.name;
  return n || "";
}

export function floorNumber(o: THREE.Object3D): number | null {
  const m = FLOOR_RE.exec(displayName(o));
  return m ? Number(m[1]) : null;
}

export type NodeKind = "group" | "mesh" | "instanced" | "points" | "line" | "light" | "camera" | "bone" | "object";

export function kindOf(o: THREE.Object3D): NodeKind {
  const a = o as THREE.Object3D & Record<string, unknown>;
  if (a.isInstancedMesh) return "instanced";
  if (a.isMesh) return "mesh";
  if (a.isPoints) return "points";
  if (a.isLine) return "line";
  if (a.isLight) return "light";
  if (a.isCamera) return "camera";
  if (a.isBone) return "bone";
  if (o.children.length) return "group";
  return "object";
}

export function isRenderable(o: THREE.Object3D): o is THREE.Mesh | THREE.Points | THREE.Line {
  const a = o as unknown as Record<string, unknown>;
  return Boolean(a.isMesh || a.isPoints || a.isLine);
}

export function materialsOf(o: THREE.Object3D): THREE.Material[] {
  const m = (o as THREE.Mesh).material;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

export function trianglesOf(o: THREE.Object3D): number {
  const mesh = o as THREE.Mesh;
  if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return 0;
  const g = mesh.geometry;
  const pos = g.getAttribute("position");
  if (!pos) return 0;
  const base = g.index ? g.index.count / 3 : pos.count / 3;
  const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
  return Math.floor(base) * inst;
}

export function verticesOf(o: THREE.Object3D): number {
  const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
  const pos = g?.getAttribute?.("position");
  return pos ? pos.count : 0;
}

export function isAncestor(a: THREE.Object3D, b: THREE.Object3D) {
  let p = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}

/** visible through the whole ancestor chain (up to and including `stop`) and on the default layer */
export function isShown(o: THREE.Object3D, stop?: THREE.Object3D | null): boolean {
  if (!o.layers.isEnabled(0) && isRenderable(o)) return false;
  let p: THREE.Object3D | null = o;
  while (p) {
    if (!p.visible) return false;
    if (p === stop) break;
    p = p.parent;
  }
  return true;
}

export function isLocked(o: THREE.Object3D, stop?: THREE.Object3D | null): boolean {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (p.userData.__locked) return true;
    if (p === stop) break;
    p = p.parent;
  }
  return false;
}

export function renderablesUnder(o: THREE.Object3D, onlyShown = true, stop?: THREE.Object3D | null): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && (!onlyShown || isShown(c, stop))) out.push(c as THREE.Mesh);
  });
  return out;
}

/** Fast world box (geometry bounding boxes × matrixWorld) of the shown meshes under `o`. */
export function worldBox(o: THREE.Object3D, onlyShown = true, stop?: THREE.Object3D | null): THREE.Box3 {
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!(m.isMesh || (c as THREE.Points).isPoints || (c as THREE.Line).isLine) || !m.geometry) return;
    if (onlyShown && !isShown(c, stop)) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      const im = m as THREE.InstancedMesh;
      if (!im.boundingBox) im.computeBoundingBox();
      tmp.copy(im.boundingBox!).applyMatrix4(m.matrixWorld);
    } else tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    box.union(tmp);
  });
  return box;
}

export function texturesOf(m: THREE.Material): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) out.push(v as THREE.Texture);
  return out;
}

export function disposeObject(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    materialsOf(o).forEach((x) => mats.add(x));
  });
  const tex = new Set<THREE.Texture>();
  mats.forEach((m) => texturesOf(m).forEach((t) => tex.add(t)));
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  tex.forEach((t) => {
    t.dispose();
    const img = t.image as { close?: () => void } | undefined;
    img?.close?.();
  });
}

// ───────────────────────────── floors ─────────────────────────────

export interface FloorNode {
  n: number;
  obj: THREE.Object3D;
}

export function detectParts(root: THREE.Object3D) {
  const floors: FloorNode[] = [];
  let roof: THREE.Object3D | null = null;
  let podium: THREE.Object3D | null = null;
  let site: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (o === root) return;
    const n = floorNumber(o);
    if (n !== null) {
      if (!floors.some((f) => f.obj === o || isAncestor(f.obj, o))) floors.push({ n, obj: o });
      return;
    }
    const name = displayName(o).toLowerCase();
    if (!roof && /^(roof|tom)$/.test(name)) roof = o;
    else if (!podium && /^(podium|stylobate|stilobat)$/.test(name)) podium = o;
    else if (!site && /^(site|hudud|landscape)$/.test(name)) site = o;
  });
  floors.sort((a, b) => a.n - b.n);
  return { floors, roof: roof as THREE.Object3D | null, podium: podium as THREE.Object3D | null, site: site as THREE.Object3D | null };
}

export interface FloorInfo {
  uuid: string;
  n: number;
  name: string;
  elevation: number;
  top: number;
  height: number;
  /** distance to the next floor's base (floor-to-floor) */
  step: number | null;
  triangles: number;
  meshes: number;
  visible: boolean;
}

// ───────────────────────────── stats ─────────────────────────────

export interface SceneStats {
  nodes: number;
  groups: number;
  meshes: number;
  instanced: number;
  points: number;
  lights: number;
  cameras: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
  textureBytes: number;
  geometryBytes: number;
  drawCalls: number;
  size: [number, number, number];
  minY: number;
  maxY: number;
  footprint: number;
  buildingSize: [number, number, number] | null;
  buildingFootprint: number | null;
  floors: number;
  typicalFloorHeight: number | null;
  hidden: number;
}

export function computeStats(root: THREE.Object3D, site: THREE.Object3D | null, floors: FloorInfo[]): SceneStats {
  root.updateWorldMatrix(true, true);
  let nodes = 0,
    groups = 0,
    meshes = 0,
    instanced = 0,
    points = 0,
    lights = 0,
    cameras = 0,
    triangles = 0,
    vertices = 0,
    drawCalls = 0,
    hidden = 0;
  const mats = new Set<THREE.Material>();
  const geos = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    if (o === root) return;
    nodes++;
    if (!o.visible) hidden++;
    const k = kindOf(o);
    if (k === "group") groups++;
    else if (k === "mesh" || k === "instanced") {
      meshes++;
      if (k === "instanced") instanced++;
      triangles += trianglesOf(o);
      vertices += verticesOf(o);
      const g = (o as THREE.Mesh).geometry;
      geos.add(g);
      drawCalls += Math.max(1, g.groups.length);
    } else if (k === "points") points++;
    else if (k === "light") lights++;
    else if (k === "camera") cameras++;
    materialsOf(o).forEach((m) => mats.add(m));
  });
  let geometryBytes = 0;
  geos.forEach((g) => {
    for (const a of Object.values(g.attributes)) geometryBytes += (a as THREE.BufferAttribute).array?.byteLength ?? 0;
    if (g.index) geometryBytes += g.index.array.byteLength;
  });
  const tex = new Set<THREE.Texture>();
  mats.forEach((m) => texturesOf(m).forEach((t) => tex.add(t)));
  let textureBytes = 0;
  tex.forEach((t) => {
    const img = t.image as { width?: number; height?: number } | undefined;
    if (img?.width && img.height) textureBytes += img.width * img.height * 4 * 1.33;
  });

  const box = worldBox(root, false);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  let buildingSize: [number, number, number] | null = null;
  let buildingFootprint: number | null = null;
  if (site) {
    const b = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !isAncestor(site, o) && o !== site) b.union(worldBox(o, false));
    });
    if (!b.isEmpty()) {
      const s = b.getSize(new THREE.Vector3());
      buildingSize = [s.x, s.y, s.z];
      buildingFootprint = s.x * s.z;
    }
  }
  const steps = floors.map((f) => f.step).filter((x): x is number => x !== null && x > 0.5);
  const typical = steps.length ? median(steps) : floors.length ? median(floors.map((f) => f.height)) : null;
  return {
    nodes,
    groups,
    meshes,
    instanced,
    points,
    lights,
    cameras,
    triangles,
    vertices,
    materials: mats.size,
    textures: tex.size,
    textureBytes,
    geometryBytes,
    drawCalls,
    size: [size.x, size.y, size.z],
    minY: box.isEmpty() ? 0 : box.min.y,
    maxY: box.isEmpty() ? 0 : box.max.y,
    footprint: size.x * size.z,
    buildingSize,
    buildingFootprint,
    floors: floors.length,
    typicalFloorHeight: typical,
    hidden,
  };
}

export function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

// ───────────────────────────── planar area ─────────────────────────────

/**
 * Connected planar region around a hit triangle (world space): sums the area of every triangle that is
 * coplanar with the hit face and shares a vertex with the region. Works for slabs, roofs, walls.
 */
export function planarRegion(mesh: THREE.Mesh, faceIndex: number, tol = 0.02) {
  const g = mesh.geometry;
  const pos = g.getAttribute("position") as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  if (!pos) return null;
  const idx = g.index;
  const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
  if (faceIndex < 0 || faceIndex >= triCount) return null;
  mesh.updateWorldMatrix(true, false);
  const mw = mesh.matrixWorld;
  const va = new THREE.Vector3(),
    vb = new THREE.Vector3(),
    vc = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3(),
    n = new THREE.Vector3();
  const vi = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const tri = (t: number) => {
    va.fromBufferAttribute(pos, vi(t, 0)).applyMatrix4(mw);
    vb.fromBufferAttribute(pos, vi(t, 1)).applyMatrix4(mw);
    vc.fromBufferAttribute(pos, vi(t, 2)).applyMatrix4(mw);
    ab.subVectors(vb, va);
    ac.subVectors(vc, va);
    n.crossVectors(ab, ac);
    return n.length() / 2;
  };
  tri(faceIndex);
  const n0 = n.clone().normalize();
  const d0 = n0.dot(va);
  // candidates
  const key = (v: THREE.Vector3) => `${Math.round(v.x * 200)},${Math.round(v.y * 200)},${Math.round(v.z * 200)}`;
  const cand = new Map<number, { area: number; keys: string[]; p: number[] }>();
  const byKey = new Map<string, number[]>();
  const limit = Math.min(triCount, 400_000);
  for (let t = 0; t < limit; t++) {
    const area = tri(t);
    if (area < 1e-9) continue;
    n.normalize();
    if (n.dot(n0) < 0.999 || Math.abs(n0.dot(va) - d0) > tol) continue;
    const ks = [key(va), key(vb), key(vc)];
    cand.set(t, { area, keys: ks, p: [va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z] });
    for (const k of ks) {
      const l = byKey.get(k);
      if (l) l.push(t);
      else byKey.set(k, [t]);
    }
  }
  const seen = new Set<number>([faceIndex]);
  const queue = [faceIndex];
  let total = 0;
  const out: number[] = [];
  while (queue.length) {
    const t = queue.pop()!;
    const c = cand.get(t);
    if (!c) continue;
    total += c.area;
    out.push(...c.p);
    for (const k of c.keys)
      for (const nb of byKey.get(k) ?? [])
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
  }
  const tris = new Float32Array(out);
  const off = n0.clone().multiplyScalar(0.03);
  const centroid = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3) {
    tris[i] += off.x;
    tris[i + 1] += off.y;
    tris[i + 2] += off.z;
    centroid.x += tris[i]!;
    centroid.y += tris[i + 1]!;
    centroid.z += tris[i + 2]!;
  }
  centroid.divideScalar(Math.max(1, tris.length / 3));
  return { area: total, tris, normal: n0, centroid };
}

// ───────────────────────────── formatting ─────────────────────────────

const nf = (d: number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
const cache = new Map<number, Intl.NumberFormat>();
export function fmtNum(v: number, digits = 2) {
  let f = cache.get(digits);
  if (!f) cache.set(digits, (f = nf(digits)));
  return f.format(v).replace(/ /g, " ");
}
export const fmtInt = (v: number) => fmtNum(Math.round(v), 0);
export const fmtM = (v: number, d = 2) => `${fmtNum(v, d)} m`;
export const fmtM2 = (v: number, d = 1) => `${fmtNum(v, d)} m²`;

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "model"
  );
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
