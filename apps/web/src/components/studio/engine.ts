"use client";
// Studio engine: owns the three.js model and every mutation on it (selection, visibility, transforms,
// materials, explode, section, isolation) with an undo/redo history. React panels read through `store`.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { LoadResult } from "./loaders";
import type { StudioStore, ViewName, Measure, AreaMeasure, Pin } from "./store";
import {
  computeStats,
  detectParts,
  disposeObject,
  displayName,
  isAncestor,
  isLocked,
  isRenderable,
  materialsOf,
  trianglesOf,
  worldBox,
  type FloorInfo,
  type FloorNode,
  type SceneStats,
} from "./scene-utils";

// ───────────────────────────── history ─────────────────────────────

export interface Command {
  label: string;
  undo(): void;
  redo(): void;
  /** commands with the same key pushed within a short window are merged (sliders, colour pickers) */
  key?: string;
  at?: number;
  /** value handed to `merge` of the previous command with the same key */
  payload?: unknown;
  merge?(payload: unknown): void;
}

class History {
  stack: Command[] = [];
  index = 0;
  saved = 0;
  push(c: Command) {
    if (this.index < this.stack.length) {
      this.stack.length = this.index;
      if (this.saved > this.index) this.saved = -1;
    }
    const top = this.stack[this.index - 1];
    c.at = performance.now();
    if (top && c.key && top.key === c.key && top.merge && c.at - (top.at ?? 0) < 1200) {
      top.merge(c.payload);
      top.at = c.at;
      if (this.saved === this.index) this.saved = -1;
      return;
    }
    this.stack.push(c);
    this.index++;
    if (this.stack.length > 300) {
      this.stack.shift();
      this.index--;
      this.saved--;
    }
  }
  undo() {
    if (!this.index) return null;
    const c = this.stack[--this.index]!;
    c.undo();
    return c;
  }
  redo() {
    if (this.index >= this.stack.length) return null;
    const c = this.stack[this.index++]!;
    c.redo();
    return c;
  }
  get dirty() {
    return this.index !== this.saved;
  }
  clear() {
    this.stack = [];
    this.index = 0;
    this.saved = 0;
  }
}

// ───────────────────────────── types ─────────────────────────────

export type TRS = { p: [number, number, number]; q: [number, number, number, number]; s: [number, number, number] };

export interface CameraApi {
  fit(box?: THREE.Box3 | null, opts?: { view?: ViewName; instant?: boolean }): void;
  view(name: ViewName): void;
  focus(point: THREE.Vector3, distance?: number): void;
  screenshot(labels: { measures: Measure[]; areas: AreaMeasure[]; pins: Pin[] }): Promise<Blob | null>;
}

export type MatKey =
  | "name"
  | "color"
  | "metalness"
  | "roughness"
  | "opacity"
  | "transmission"
  | "ior"
  | "thickness"
  | "emissive"
  | "emissiveIntensity"
  | "envMapIntensity"
  | "side"
  | "flatShading";
export type MatPatch = Partial<Record<MatKey, number | string | boolean>>;

type Base = { opacity: number; transparent: boolean; transparent0: boolean; depthWrite: boolean; wireframe: boolean };

type AnyMat = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  metalness?: number;
  roughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  wireframe?: boolean;
  flatShading?: boolean;
  isMeshPhysicalMaterial?: boolean;
  isMeshStandardMaterial?: boolean;
};

const NOTES_PREFIX = "eka.studio.notes.v1:";

function findContainer(root: THREE.Object3D) {
  let c = root;
  while (c.children.length === 1 && !isRenderable(c.children[0]!) && c.children[0]!.children.length) c = c.children[0]!;
  return c;
}

// ───────────────────────────── engine ─────────────────────────────

export class Engine {
  root: THREE.Object3D | null = null;
  readonly wrapper = new THREE.Group();
  info: LoadResult | null = null;
  key = "";
  parts: { floors: FloorNode[]; roof: THREE.Object3D | null; podium: THREE.Object3D | null; site: THREE.Object3D | null } = {
    floors: [],
    roof: null,
    podium: null,
    site: null,
  };
  container: THREE.Object3D | null = null;
  materials: THREE.Material[] = [];
  readonly history = new History();
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  bounds = { box: new THREE.Box3(), frame: new THREE.Box3(), center: new THREE.Vector3(), radius: 20 };
  floorGap = 3.5;
  recentered = false;
  invalidate: () => void = () => {};
  cam: CameraApi | null = null;
  canvas: HTMLCanvasElement | null = null;
  /** last camera pose — survives perspective ⇄ orthographic switches */
  camView = { pos: new THREE.Vector3(90, 70, 110), target: new THREE.Vector3(0, 10, 0), zoom: 6, ortho: false };
  camAnimating = false;
  /** UI feedback for refused edits (e.g. the object is locked) */
  notify: (reason: "locked") => void = () => {};
  /** material the inspector should open next (set from the properties panel) */
  focusMaterial: string | null = null;
  /** set on load; the camera rig frames the model on its next frame */
  pendingFit = false;
  private index = new Map<string, THREE.Object3D>();
  private statsCache: SceneStats | null = null;
  private floorsCache: FloorInfo[] | null = null;
  private drag: { uuid: string; trs: TRS } | null = null;

  constructor(readonly store: StudioStore) {
    this.wrapper.name = "__studio_wrapper";
  }

  // ── lifecycle ──
  load(result: LoadResult, key: string) {
    this.unload();
    this.info = result;
    this.key = key;
    const root = result.root;
    this.root = root;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.wrapper.position.set(0, 0, 0);
    this.wrapper.add(root);
    this.wrapper.updateMatrixWorld(true);
    const box = worldBox(root, false);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    this.recentered = false;
    if (!box.isEmpty() && new THREE.Vector2(c.x, c.z).length() > Math.max(500, r * 8)) {
      this.wrapper.position.set(-c.x, -box.min.y, -c.z);
      this.wrapper.updateMatrixWorld(true);
      this.recentered = true;
    }
    this.container = findContainer(root);
    this.parts = detectParts(root);
    this.history.clear();
    this.reindex();
    this.collectMaterials();
    this.computeBounds();
    const floors = this.floors();
    const steps = floors.map((f) => f.step).filter((x): x is number => x !== null && x > 0.5);
    this.floorGap = steps.length ? steps.sort((a, b) => a - b)[Math.floor(steps.length / 2)]! : 3.5;
    const notes = this.readNotes();
    const s = this.store.get();
    this.store.set({
      loaded: true,
      selection: null,
      hover: null,
      isolated: null,
      explode: 0,
      section: { ...s.section, enabled: false },
      measures: notes.measures,
      areas: notes.areas,
      pins: notes.pins,
      activePin: null,
      pickMode: this.parts.floors.length ? "group" : "object",
    });
    this.applyDisplay();
    this.updateSection();
    this.syncHistory();
    this.pendingFit = true;
    this.bump();
  }

  unload() {
    if (this.root) {
      this.wrapper.remove(this.root);
      disposeObject(this.root);
    }
    this.info?.cleanup();
    this.root = null;
    this.info = null;
    this.index.clear();
    this.materials = [];
    this.statsCache = null;
    this.floorsCache = null;
  }

  // ── bookkeeping ──
  reindex() {
    this.index.clear();
    this.root?.traverse((o) => this.index.set(o.uuid, o));
  }

  collectMaterials() {
    const set = new Set<THREE.Material>();
    this.root?.traverse((o) => materialsOf(o).forEach((m) => set.add(m)));
    this.materials = [...set];
  }

  computeBounds() {
    if (!this.root) return;
    const box = worldBox(this.root, false);
    let frame = new THREE.Box3();
    const site = this.parts.site;
    if (site) {
      this.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o !== site && !isAncestor(site, o)) frame.union(worldBox(o, false));
      });
    }
    if (frame.isEmpty()) frame = box.clone();
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(10, 10, 10));
    if (frame.isEmpty()) frame = box.clone();
    this.bounds = {
      box,
      frame,
      center: box.getCenter(new THREE.Vector3()),
      radius: Math.max(1, box.getSize(new THREE.Vector3()).length() / 2),
    };
  }

  bump(structural = false) {
    if (structural) {
      this.reindex();
      this.collectMaterials();
      if (this.root) this.parts = detectParts(this.root);
      this.applyIsolation();
      this.applyDisplay();
    }
    this.statsCache = null;
    this.floorsCache = null;
    this.store.set((s) => ({ version: s.version + 1 }));
    this.invalidate();
  }

  get(uuid: string | null | undefined): THREE.Object3D | null {
    return uuid ? (this.index.get(uuid) ?? null) : null;
  }

  syncHistory() {
    const h = this.history;
    this.store.set({
      canUndo: h.index > 0,
      canRedo: h.index < h.stack.length,
      dirty: h.dirty,
      undoLabel: h.stack[h.index - 1]?.label ?? null,
      redoLabel: h.stack[h.index]?.label ?? null,
    });
  }

  private push(c: Command) {
    this.history.push(c);
    this.syncHistory();
  }

  undo() {
    const c = this.history.undo();
    this.syncHistory();
    return c;
  }
  redo() {
    const c = this.history.redo();
    this.syncHistory();
    return c;
  }
  markSaved() {
    this.history.saved = this.history.index;
    this.syncHistory();
  }

  // ── selection ──
  select(uuid: string | null) {
    this.store.set({ selection: uuid && this.index.has(uuid) ? uuid : null });
    this.invalidate();
  }

  /** what a click on `mesh` selects: in "group" mode the top-level part (floor-3, podium…), drilling down on repeat clicks */
  pickTarget(mesh: THREE.Object3D): THREE.Object3D {
    const { pickMode, selection } = this.store.get();
    if (pickMode === "object" || !this.container) return mesh;
    const sel = this.get(selection);
    if (sel && sel !== mesh && isAncestor(sel, mesh)) {
      let x: THREE.Object3D = mesh;
      while (x.parent && x.parent !== sel) x = x.parent;
      return x;
    }
    let t: THREE.Object3D = mesh;
    while (t.parent && t.parent !== this.container && t !== this.root) t = t.parent;
    return t.parent === this.container ? t : mesh;
  }

  // ── visibility / lock / isolate ──
  setVisible(uuids: string[], visible: boolean | ((o: THREE.Object3D) => boolean), label = "visibility") {
    const objs = uuids.map((u) => this.get(u)).filter((o): o is THREE.Object3D => Boolean(o));
    if (!objs.length) return;
    const before = objs.map((o) => o.visible);
    const after = objs.map((o) => (typeof visible === "function" ? visible(o) : visible));
    const apply = (vals: boolean[]) => {
      objs.forEach((o, i) => (o.visible = vals[i]!));
      this.bump();
    };
    apply(after);
    this.push({ label, undo: () => apply(before), redo: () => apply(after) });
  }

  /** locked objects (or objects inside a locked group) refuse edits */
  private guard(o: THREE.Object3D) {
    if (!isLocked(o, this.root)) return true;
    this.notify("locked");
    return false;
  }

  toggleVisible(uuid: string) {
    const o = this.get(uuid);
    if (o && this.guard(o)) this.setVisible([uuid], !o.visible, o.visible ? "hide" : "show");
  }

  showAll() {
    const hidden: string[] = [];
    this.root?.traverse((o) => !o.visible && hidden.push(o.uuid));
    if (hidden.length) this.setVisible(hidden, true, "showAll");
  }

  toggleLock(uuid: string) {
    const o = this.get(uuid);
    if (!o) return;
    o.userData.__locked = !o.userData.__locked;
    if (!o.userData.__locked) delete o.userData.__locked;
    this.bump();
  }

  isolate(uuid: string | null) {
    const cur = this.store.get().isolated;
    const next = uuid && uuid !== cur ? uuid : null;
    this.store.set({ isolated: next });
    this.applyIsolation();
    this.bump();
  }

  applyIsolation() {
    const iso = this.get(this.store.get().isolated);
    this.root?.traverse((o) => {
      if (!isRenderable(o)) return;
      const inside = !iso || o === iso || isAncestor(iso, o);
      o.layers.set(inside ? 0 : 1);
    });
  }

  // ── structure edits ──
  rename(uuid: string, name: string) {
    const o = this.get(uuid);
    const next = name.trim();
    if (!o || !next || next === displayName(o) || !this.guard(o)) return;
    const before = { name: o.name, u: o.userData.name as string | undefined };
    const apply = (n: string, u: string | undefined) => {
      o.name = n;
      if (u === undefined) delete o.userData.name;
      else o.userData.name = u;
      this.bump(true);
    };
    apply(next, next);
    this.push({ label: "rename", undo: () => apply(before.name, before.u), redo: () => apply(next, next) });
  }

  remove(uuid: string) {
    const o = this.get(uuid);
    if (!o || o === this.root || !o.parent || !this.guard(o)) return false;
    const parent = o.parent;
    const idx = parent.children.indexOf(o);
    const doIt = () => {
      parent.remove(o);
      const sel = this.get(this.store.get().selection);
      if (sel && (sel === o || isAncestor(o, sel))) this.store.set({ selection: null });
      if (this.store.get().isolated === o.uuid) this.store.set({ isolated: null });
      this.bump(true);
    };
    const undo = () => {
      parent.add(o);
      parent.children.splice(parent.children.indexOf(o), 1);
      parent.children.splice(Math.min(idx, parent.children.length), 0, o);
      this.bump(true);
      this.store.set({ selection: o.uuid });
    };
    doIt();
    this.push({ label: "delete", undo, redo: doIt });
    return true;
  }

  duplicate(uuid: string) {
    const o = this.get(uuid);
    if (!o || o === this.root || !o.parent || !this.guard(o)) return null;
    const parent = o.parent;
    const copy = o.clone(true);
    const base = displayName(o).replace(/\.\d{3}$/, "");
    const names = new Set(parent.children.map(displayName));
    let i = 1;
    while (names.has(`${base}.${String(i).padStart(3, "0")}`)) i++;
    copy.name = `${base}.${String(i).padStart(3, "0")}`;
    copy.userData.name = copy.name;
    const xo = (copy.userData.__xo as number | undefined) ?? 0;
    if (xo) copy.position.y -= xo;
    delete copy.userData.__xo;
    delete copy.userData.__xow;
    const box = worldBox(o, false);
    const ws = parent.getWorldScale(new THREE.Vector3());
    const dx = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).x * 0.12 + 1;
    copy.position.x += dx / (ws.x || 1);
    const idx = parent.children.indexOf(o) + 1;
    const add = () => {
      parent.add(copy);
      parent.children.splice(parent.children.indexOf(copy), 1);
      parent.children.splice(Math.min(idx, parent.children.length), 0, copy);
      this.bump(true);
      this.store.set({ selection: copy.uuid });
    };
    const rem = () => {
      parent.remove(copy);
      if (this.store.get().selection === copy.uuid) this.store.set({ selection: o.uuid });
      this.bump(true);
    };
    add();
    this.push({ label: "duplicate", undo: rem, redo: add });
    return copy;
  }

  // ── transforms (explode offsets are kept out of recorded values) ──
  readTRS(o: THREE.Object3D): TRS {
    const xo = (o.userData.__xo as number | undefined) ?? 0;
    return {
      p: [o.position.x, o.position.y - xo, o.position.z],
      q: o.quaternion.toArray() as TRS["q"],
      s: o.scale.toArray() as TRS["s"],
    };
  }

  writeTRS(o: THREE.Object3D, t: TRS) {
    const xo = (o.userData.__xo as number | undefined) ?? 0;
    o.position.set(t.p[0], t.p[1] + xo, t.p[2]);
    o.quaternion.fromArray(t.q);
    o.scale.fromArray(t.s);
    o.updateMatrixWorld(true);
  }

  beginTransform(o: THREE.Object3D) {
    this.drag = { uuid: o.uuid, trs: this.readTRS(o) };
  }

  endTransform(o: THREE.Object3D) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.uuid !== o.uuid) return;
    const before = d.trs;
    const after = this.readTRS(o);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.push({
      label: "transform",
      undo: () => {
        this.writeTRS(o, before);
        this.bump();
      },
      redo: () => {
        this.writeTRS(o, after);
        this.bump();
      },
    });
    this.bump();
  }

  setTRS(uuid: string, next: TRS, key: string) {
    const o = this.get(uuid);
    if (!o) return;
    const before = this.readTRS(o);
    const state = { after: next };
    this.writeTRS(o, next);
    this.bump();
    this.push({
      label: "transform",
      key: `trs:${uuid}:${key}`,
      undo: () => {
        this.writeTRS(o, before);
        this.bump();
      },
      redo: () => {
        this.writeTRS(o, state.after);
        this.bump();
      },
      payload: next,
      merge: (p) => {
        state.after = p as TRS;
      },
    });
  }

  resetTransform(uuid: string) {
    this.setTRS(uuid, { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] }, "reset");
  }

  /** rotates the whole model -90° about X (Z-up → Y-up) */
  fixUpAxis() {
    const r = this.root;
    if (!r) return;
    const before = this.readTRS(r);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).multiply(r.quaternion);
    const after: TRS = { ...before, q: q.toArray() as TRS["q"] };
    const apply = (t: TRS) => {
      this.writeTRS(r, t);
      this.computeBounds();
      this.bump();
    };
    apply(after);
    this.push({ label: "upAxis", undo: () => apply(before), redo: () => apply(after) });
  }

  // ── materials ──
  private base(m: THREE.Material): Base {
    const a = m as AnyMat;
    let b = m.userData.__sb as Base | undefined;
    if (!b) {
      b = { opacity: m.opacity, transparent: m.transparent, transparent0: m.transparent, depthWrite: m.depthWrite, wireframe: Boolean(a.wireframe) };
      m.userData.__sb = b;
    }
    return b;
  }

  readMat(m: THREE.Material, k: MatKey): number | string | boolean {
    const a = m as AnyMat;
    switch (k) {
      case "name":
        return m.name;
      case "color":
        return a.color ? `#${a.color.getHexString()}` : "#ffffff";
      case "emissive":
        return a.emissive ? `#${a.emissive.getHexString()}` : "#000000";
      case "opacity":
        return this.base(m).opacity;
      case "side":
        return m.side;
      case "flatShading":
        return Boolean(a.flatShading);
      default:
        return (a[k] as number | undefined) ?? 0;
    }
  }

  private writeMat(m: THREE.Material, k: MatKey, v: number | string | boolean) {
    const a = m as AnyMat;
    switch (k) {
      case "name":
        m.name = String(v);
        break;
      case "color":
        a.color?.set(String(v));
        break;
      case "emissive":
        a.emissive?.set(String(v));
        break;
      case "opacity": {
        const b = this.base(m);
        b.opacity = Number(v);
        b.transparent = b.transparent0 || Number(v) < 0.999;
        break;
      }
      case "side":
        m.side = Number(v) as THREE.Side;
        m.needsUpdate = true;
        break;
      case "flatShading":
        a.flatShading = Boolean(v);
        m.needsUpdate = true;
        break;
      case "transmission": {
        const was = (a.transmission ?? 0) > 0;
        a.transmission = Number(v);
        if (was !== Number(v) > 0) m.needsUpdate = true;
        break;
      }
      default:
        (a as unknown as Record<string, number>)[k] = Number(v);
    }
  }

  editMaterial(m: THREE.Material, patch: MatPatch, label = "material") {
    const keys = Object.keys(patch) as MatKey[];
    if (!keys.length) return;
    const before: MatPatch = {};
    for (const k of keys) before[k] = this.readMat(m, k);
    const state = { after: { ...patch } };
    const apply = (p: MatPatch) => {
      for (const k of Object.keys(p) as MatKey[]) this.writeMat(m, k, p[k]!);
      this.applyDisplay([m]);
      this.bump(keys.includes("name"));
    };
    apply(patch);
    this.push({
      label,
      key: `mat:${m.uuid}:${keys.sort().join(",")}`,
      undo: () => apply(before),
      redo: () => apply(state.after),
      payload: patch,
      merge: (p) => {
        state.after = p as MatPatch;
      },
    });
  }

  meshesUsing(m: THREE.Material): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.root?.traverse((o) => {
      if (materialsOf(o).includes(m)) out.push(o as THREE.Mesh);
    });
    return out;
  }

  /** gives `meshes` their own copy of `m` (so edits don't affect other objects) */
  makeUnique(m: THREE.Material, meshes: THREE.Mesh[]) {
    if (!meshes.length) return null;
    const copy = m.clone();
    copy.name = `${m.name || "material"}.copy`;
    copy.userData = { ...m.userData, __sb: { ...this.base(m) } };
    const swap = (from: THREE.Material, to: THREE.Material) => {
      for (const mesh of meshes) {
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((x) => (x === from ? to : x));
        else if (mesh.material === from) mesh.material = to;
      }
      this.bump(true);
    };
    swap(m, copy);
    this.push({ label: "makeUnique", undo: () => swap(copy, m), redo: () => swap(m, copy) });
    return copy;
  }

  /** x-ray / wireframe / section clipping on top of the "base" (exported) material values */
  applyDisplay(only?: THREE.Material[]) {
    const s = this.store.get();
    const clip = s.section.enabled ? [this.plane] : null;
    for (const m of only ?? this.materials) {
      const a = m as AnyMat;
      const b = this.base(m);
      const prevClip = m.clippingPlanes?.length ?? 0;
      const prevTransparent = m.transparent;
      m.opacity = s.xray ? Math.min(b.opacity, 0.2) : b.opacity;
      m.transparent = s.xray ? true : b.transparent;
      m.depthWrite = s.xray ? false : b.depthWrite;
      if ("wireframe" in a) a.wireframe = s.wireframe || b.wireframe;
      m.clippingPlanes = clip;
      m.clipShadows = true;
      if (prevClip !== (clip?.length ?? 0) || prevTransparent !== m.transparent) m.needsUpdate = true;
    }
    this.invalidate();
  }

  // ── section ──
  updateSection() {
    const s = this.store.get().section;
    const box = this.bounds.box;
    const ax = s.axis;
    const min = box.min[ax];
    const max = box.max[ax];
    const pos = min + (max - min) * s.offset;
    const n = new THREE.Vector3(ax === "x" ? 1 : 0, ax === "y" ? 1 : 0, ax === "z" ? 1 : 0);
    if (s.flip) this.plane.set(n, -pos);
    else this.plane.set(n.negate(), pos);
    this.invalidate();
  }

  sectionPosition() {
    const s = this.store.get().section;
    const box = this.bounds.box;
    return box.min[s.axis] + (box.max[s.axis] - box.min[s.axis]) * s.offset;
  }

  // ── explode ──
  setExplode(v: number) {
    const { floors, roof } = this.parts;
    const gap = Math.max(1, this.floorGap) * 1.6;
    const apply = (o: THREE.Object3D, world: number) => {
      const ws = o.parent ? o.parent.getWorldScale(new THREE.Vector3()).y || 1 : 1;
      const local = world / ws;
      const prev = (o.userData.__xo as number | undefined) ?? 0;
      o.position.y += local - prev;
      if (local) {
        o.userData.__xo = local;
        o.userData.__xow = world;
      } else {
        delete o.userData.__xo;
        delete o.userData.__xow;
      }
      o.updateMatrixWorld(true);
    };
    floors.forEach((f, i) => apply(f.obj, i * v * gap));
    if (roof) apply(roof, floors.length * v * gap);
    this.store.set({ explode: v });
    this.statsCache = null;
    this.invalidate();
  }

  /** run `fn` with exploded floors temporarily back in place (stats/dimensions describe the real building) */
  withoutExplode<T>(fn: () => T): T {
    const moved: [THREE.Object3D, number][] = [];
    this.root?.traverse((o) => {
      const xo = o.userData.__xo as number | undefined;
      if (xo) moved.push([o, xo]);
    });
    if (!moved.length) return fn();
    for (const [o, xo] of moved) o.position.y -= xo;
    this.root!.updateMatrixWorld(true);
    try {
      return fn();
    } finally {
      for (const [o, xo] of moved) o.position.y += xo;
      this.root!.updateMatrixWorld(true);
    }
  }

  explodeGap() {
    return Math.max(1, this.floorGap) * 1.6;
  }

  // ── derived data ──
  floors(): FloorInfo[] {
    if (this.floorsCache) return this.floorsCache;
    const list = this.parts.floors
      .filter((f) => this.index.has(f.obj.uuid))
      .map((f) => {
        const b = worldBox(f.obj, false);
        const xow = (f.obj.userData.__xow as number | undefined) ?? 0;
        let tris = 0;
        let meshes = 0;
        f.obj.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            meshes++;
            tris += trianglesOf(o);
          }
        });
        const elevation = b.isEmpty() ? 0 : b.min.y - xow;
        const top = b.isEmpty() ? 0 : b.max.y - xow;
        return {
          uuid: f.obj.uuid,
          n: f.n,
          name: displayName(f.obj),
          elevation,
          top,
          height: top - elevation,
          step: null as number | null,
          triangles: tris,
          meshes,
          visible: f.obj.visible,
        };
      });
    for (let i = 0; i < list.length - 1; i++) list[i]!.step = list[i + 1]!.elevation - list[i]!.elevation;
    this.floorsCache = list;
    return list;
  }

  stats(): SceneStats | null {
    if (!this.root) return null;
    if (!this.statsCache) {
      const floors = this.floors();
      this.statsCache = this.withoutExplode(() => computeStats(this.root!, this.parts.site, floors));
    }
    return this.statsCache;
  }

  // ── notes persistence (localStorage, per model) ──
  readNotes(): { measures: Measure[]; areas: AreaMeasure[]; pins: Pin[] } {
    const empty = { measures: [], areas: [], pins: [] };
    if (!this.key) return empty;
    try {
      const raw = localStorage.getItem(NOTES_PREFIX + this.key);
      if (!raw) return empty;
      const d = JSON.parse(raw) as { measures?: Measure[]; areas?: AreaMeasure[]; pins?: Pin[] };
      return { measures: d.measures ?? [], areas: d.areas ?? [], pins: d.pins ?? [] };
    } catch {
      return empty;
    }
  }

  writeNotes() {
    if (!this.key) return;
    const { measures, areas, pins } = this.store.get();
    try {
      if (!measures.length && !areas.length && !pins.length) localStorage.removeItem(NOTES_PREFIX + this.key);
      else
        localStorage.setItem(
          NOTES_PREFIX + this.key,
          JSON.stringify({ measures, areas: areas.map(({ tris: _t, ...a }) => a), pins }),
        );
    } catch {
      /* quota / private mode */
    }
  }

  // ── export ──
  async exportGLB(opts: { onlyVisible: boolean; selection?: string | null }): Promise<Blob> {
    const root = this.root;
    if (!root) throw new Error("No model");
    const target = (opts.selection && this.get(opts.selection)) || root;
    const restore: (() => void)[] = [];
    // 1) display overrides → base values
    for (const m of this.materials) {
      const a = m as AnyMat;
      const b = this.base(m);
      const saved = { o: m.opacity, t: m.transparent, d: m.depthWrite, w: a.wireframe, c: m.clippingPlanes, u: m.userData };
      m.opacity = b.opacity;
      m.transparent = b.transparent;
      m.depthWrite = b.depthWrite;
      if ("wireframe" in a) a.wireframe = b.wireframe;
      m.clippingPlanes = null;
      m.userData = Object.fromEntries(Object.entries(m.userData).filter(([k]) => !k.startsWith("__")));
      restore.push(() => {
        m.opacity = saved.o;
        m.transparent = saved.t;
        m.depthWrite = saved.d;
        if ("wireframe" in a) a.wireframe = saved.w;
        m.clippingPlanes = saved.c;
        m.userData = saved.u;
      });
    }
    // 2) explode offsets, 3) original names, 4) internal userData
    root.traverse((o) => {
      const xo = (o.userData.__xo as number | undefined) ?? 0;
      if (xo) {
        o.position.y -= xo;
        restore.push(() => (o.position.y += xo));
      }
      const savedName = o.name;
      const savedUD = o.userData;
      if (typeof o.userData.name === "string") o.name = o.userData.name;
      o.userData = Object.fromEntries(Object.entries(o.userData).filter(([k]) => !k.startsWith("__") && k !== "name"));
      restore.push(() => {
        o.name = savedName;
        o.userData = savedUD;
      });
    });
    root.updateMatrixWorld(true);
    try {
      const exporter = new GLTFExporter();
      const identity = root.position.lengthSq() === 0 && root.quaternion.equals(new THREE.Quaternion()) && root.scale.equals(new THREE.Vector3(1, 1, 1));
      let input: THREE.Object3D | THREE.Object3D[];
      if (target === root) input = identity ? root.children.slice() : root;
      else {
        // a sub-object keeps only its local transform in glTF — bake the full model-space transform
        // (parent scale / up-axis rotation, e.g. mm→m or Z-up fixes) into a detached clone
        const clone = target.clone(true);
        const m = new THREE.Matrix4().copy(this.wrapper.matrixWorld).invert().multiply(target.matrixWorld);
        m.decompose(clone.position, clone.quaternion, clone.scale);
        clone.updateMatrix();
        input = clone;
      }
      const res = await exporter.parseAsync(input, {
        binary: true,
        onlyVisible: opts.onlyVisible,
        animations: target === root ? (this.info?.animations ?? []) : [],
      });
      return new Blob([res as ArrayBuffer], { type: "model/gltf-binary" });
    } finally {
      for (let i = restore.length - 1; i >= 0; i--) restore[i]!();
      root.updateMatrixWorld(true);
      this.invalidate();
    }
  }

  dispose() {
    this.unload();
    this.cam = null;
    this.canvas = null;
  }
}
