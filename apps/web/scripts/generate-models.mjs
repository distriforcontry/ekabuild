#!/usr/bin/env node
/**
 * Generates detailed demo building models (GLB, PBR materials) with three.js in Node.
 *
 *   node apps/web/scripts/generate-models.mjs [outDir]
 *
 * Output convention (relied on by the 3D viewer): root → groups `site`, `podium`, `floor-<n>` (one per storey), `roof`.
 * Units: metres, Y-up, origin at ground centre. Meshes are merged per material inside each group to keep draw calls low.
 * Real projects upload their own GLB exported from Revit / ArchiCAD / SketchUp — these are for the demo catalogue.
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";

// GLTFExporter (binary) reads Blobs through FileReader — provide a tiny Node polyfill
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buf).toString("base64")}`;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    });
  }
};

// ───────────────────────────── materials ─────────────────────────────
const M = {
  glass: new THREE.MeshStandardMaterial({ name: "glass", color: 0x7f9fb3, metalness: 0.92, roughness: 0.06, transparent: true, opacity: 0.62 }),
  glassDark: new THREE.MeshStandardMaterial({ name: "glass-dark", color: 0x3c4a58, metalness: 0.95, roughness: 0.08, transparent: true, opacity: 0.8 }),
  gold: new THREE.MeshStandardMaterial({ name: "gold", color: 0xc9a464, metalness: 1, roughness: 0.32 }),
  stone: new THREE.MeshStandardMaterial({ name: "stone", color: 0xe9e3d6, metalness: 0, roughness: 0.78 }),
  stoneDark: new THREE.MeshStandardMaterial({ name: "stone-dark", color: 0x34353a, metalness: 0.1, roughness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ name: "frame", color: 0x2a2c31, metalness: 0.7, roughness: 0.38 }),
  railing: new THREE.MeshStandardMaterial({ name: "railing", color: 0xbfd4df, metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.35 }),
  plaza: new THREE.MeshStandardMaterial({ name: "plaza", color: 0x8b857a, metalness: 0, roughness: 0.9 }),
  grass: new THREE.MeshStandardMaterial({ name: "grass", color: 0x4f6b3a, metalness: 0, roughness: 1 }),
  foliage: new THREE.MeshStandardMaterial({ name: "foliage", color: 0x3e5a2c, metalness: 0, roughness: 0.95 }),
  trunk: new THREE.MeshStandardMaterial({ name: "trunk", color: 0x5a4632, metalness: 0, roughness: 1 }),
  tile: new THREE.MeshStandardMaterial({ name: "tile-turquoise", color: 0x1f8a9c, metalness: 0.25, roughness: 0.35 }),
  brick: new THREE.MeshStandardMaterial({ name: "brick", color: 0xc9a77c, metalness: 0, roughness: 0.85 }),
  light: new THREE.MeshStandardMaterial({ name: "light", color: 0xffe2a8, emissive: 0xffc46b, emissiveIntensity: 2.2, roughness: 0.5 }),
  water: new THREE.MeshStandardMaterial({ name: "water", color: 0x2d5f73, metalness: 0.6, roughness: 0.08 }),
};

// ───────────────────────────── geometry helpers ─────────────────────────────
class Bucket {
  constructor(name) {
    this.name = name;
    this.parts = new Map();
  }
  add(material, geometry) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute("uv");
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(g);
  }
  box(material, w, h, d, x, y, z, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    this.add(material, g);
  }
  cyl(material, rTop, rBottom, h, x, y, z, seg = 12) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(x, y + h / 2, z);
    this.add(material, g);
  }
  sphere(material, r, x, y, z, detail = 1) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.translate(x, y, z);
    this.add(material, g);
  }
  build() {
    const group = new THREE.Group();
    group.name = this.name;
    for (const [material, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${this.name}:${material.name}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Rectangular curtain-wall storey with slab edge, glass, mullions, fins and balconies. */
function storey(b, { w, d, y, h, cx = 0, cz = 0, mullion = 2.0, fins = true, balconies = false, finEvery = 3, glass = M.glass, slab = M.stone, inset = 0.35 }) {
  const slabH = 0.32;
  b.box(slab, w + 0.3, slabH, d + 0.3, cx, y, cz);
  const gh = h - slabH;
  // glass core (slightly inset)
  b.box(glass, w - inset * 2, gh, d - inset * 2, cx, y + slabH, cz);
  // mullions on all four faces
  const faces = [
    { len: w, axis: "x", off: d / 2 - inset + 0.04, sign: 1 },
    { len: w, axis: "x", off: -(d / 2 - inset + 0.04), sign: -1 },
    { len: d, axis: "z", off: w / 2 - inset + 0.04, sign: 1 },
    { len: d, axis: "z", off: -(w / 2 - inset + 0.04), sign: -1 },
  ];
  for (const f of faces) {
    const n = Math.max(2, Math.round(f.len / mullion));
    for (let i = 0; i <= n; i++) {
      const t = -f.len / 2 + (f.len * i) / n + (i === 0 ? 0.2 : i === n ? -0.2 : 0);
      const isFin = fins && i % finEvery === 0 && i !== 0 && i !== n;
      const depth = isFin ? 0.75 : 0.08;
      const mat = isFin ? M.gold : M.frame;
      const width = isFin ? 0.12 : 0.07;
      if (f.axis === "x") b.box(mat, width, gh, depth, cx + t, y + slabH, cz + f.off + (f.sign * depth) / 2);
      else b.box(mat, depth, gh, width, cx + f.off + (f.sign * depth) / 2, y + slabH, cz + t);
    }
    // transom (horizontal frame) at mid height
    if (f.axis === "x") b.box(M.frame, f.len - inset * 2, 0.06, 0.06, cx, y + slabH + gh * 0.08, cz + f.off);
    else b.box(M.frame, 0.06, 0.06, f.len - inset * 2, cx + f.off, y + slabH + gh * 0.08, cz);
  }
  if (balconies) {
    // cantilevered balconies with glass railings on the long faces, alternating bays
    const bays = Math.max(2, Math.round(w / 6));
    for (let i = 0; i < bays; i++) {
      if ((i + Math.round(y / h)) % 2) continue;
      const bx = cx - w / 2 + (w * (i + 0.5)) / bays;
      const bw = (w / bays) * 0.8;
      for (const s of [1, -1]) {
        const bz = cz + s * (d / 2 + 0.75);
        b.box(slab, bw, 0.18, 1.5, bx, y, bz);
        b.box(M.railing, bw, 1.05, 0.03, bx, y + 0.18, bz + s * 0.73);
        b.box(M.gold, bw, 0.05, 0.06, bx, y + 1.2, bz + s * 0.73);
      }
    }
  }
}

function addSite(root, { size = 90, seed = 1, water = false }) {
  const s = new Bucket("site");
  const r = rng(seed);
  s.box(M.plaza, size, 0.3, size, 0, -0.3, 0);
  // lawns
  for (const [x, z, w, d] of [
    [-size * 0.32, size * 0.3, size * 0.3, size * 0.25],
    [size * 0.32, size * 0.3, size * 0.3, size * 0.25],
    [-size * 0.32, -size * 0.32, size * 0.28, size * 0.22],
  ])
    s.box(M.grass, w, 0.05, d, x, 0, z);
  if (water) s.box(M.water, size * 0.25, 0.04, size * 0.12, size * 0.3, 0.01, -size * 0.34);
  // trees
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const rad = size * (0.36 + r() * 0.1);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const h = 2.5 + r() * 2.5;
    s.cyl(M.trunk, 0.12, 0.18, h, x, 0, z, 6);
    s.sphere(M.foliage, 1.4 + r() * 1.1, x, h + 0.6, z, 1);
  }
  // lamp posts
  for (let i = -3; i <= 3; i++) {
    s.cyl(M.frame, 0.06, 0.08, 4.2, i * 9, 0, size * 0.44, 8);
    s.sphere(M.light, 0.22, i * 9, 4.3, size * 0.44, 1);
  }
  root.add(s.build());
}

function addPodium(root, { w, d, floors = 2, h = 4.5 }) {
  const p = new Bucket("podium");
  for (let f = 0; f < floors; f++) {
    const y = f * h;
    p.box(M.stoneDark, w + 0.4, 0.45, d + 0.4, 0, y, 0);
    p.box(M.glassDark, w - 0.6, h - 0.45, d - 0.6, 0, y + 0.45, 0);
    // storefront portals
    const n = Math.round(w / 4.5);
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + (w * i) / n;
      p.box(M.stoneDark, 0.5, h - 0.45, 0.5, x, y + 0.45, d / 2 - 0.25);
      p.box(M.stoneDark, 0.5, h - 0.45, 0.5, x, y + 0.45, -d / 2 + 0.25);
    }
  }
  // entrance canopy with gold edge
  p.box(M.stone, w * 0.35, 0.35, 4.5, 0, h - 0.6, d / 2 + 2.2);
  p.box(M.gold, w * 0.35, 0.12, 0.12, 0, h - 0.75, d / 2 + 4.45);
  p.box(M.light, w * 0.3, 0.04, 3.8, 0, h - 0.64, d / 2 + 2.2);
  root.add(p.build());
  return floors * h;
}

function roofInto(r, { w, d, y, cx = 0, cz = 0, crown = true }) {
  r.box(M.stone, w + 0.3, 0.5, d + 0.3, cx, y, cz);
  r.box(M.stone, w + 0.3, 1.1, 0.25, cx, y + 0.5, cz + d / 2 + 0.02);
  r.box(M.stone, w + 0.3, 1.1, 0.25, cx, y + 0.5, cz - d / 2 - 0.02);
  r.box(M.stone, 0.25, 1.1, d + 0.3, cx + w / 2 + 0.02, y + 0.5, cz);
  r.box(M.stone, 0.25, 1.1, d + 0.3, cx - w / 2 - 0.02, y + 0.5, cz);
  r.box(M.stoneDark, w * 0.35, 3, d * 0.4, cx - w * 0.15, y + 0.5, cz);
  if (!crown) return;
  // illuminated gold crown frame
  const ch = 4.5;
  for (const [x, z] of [
    [w / 2, d / 2],
    [-w / 2, d / 2],
    [w / 2, -d / 2],
    [-w / 2, -d / 2],
  ])
    r.box(M.gold, 0.3, ch, 0.3, cx + x, y + 0.5, cz + z);
  r.box(M.gold, w + 0.3, 0.3, 0.3, cx, y + 0.5 + ch, cz + d / 2);
  r.box(M.gold, w + 0.3, 0.3, 0.3, cx, y + 0.5 + ch, cz - d / 2);
  r.box(M.gold, 0.3, 0.3, d + 0.3, cx + w / 2, y + 0.5 + ch, cz);
  r.box(M.gold, 0.3, 0.3, d + 0.3, cx - w / 2, y + 0.5 + ch, cz);
  r.box(M.light, w - 1, 0.05, 0.1, cx, y + 0.5 + ch - 0.2, cz + d / 2 - 0.1);
  r.box(M.light, w - 1, 0.05, 0.1, cx, y + 0.5 + ch - 0.2, cz - d / 2 + 0.1);
}

function addRoof(root, opts) {
  const r = new Bucket("roof");
  roofInto(r, opts);
  root.add(r.build());
}

// ───────────────────────────── building types ─────────────────────────────

function tower({ floors, w = 34, d = 18, h = 3.3, seed = 1, offsets = [{ x: 0, z: 0, floors }], balconies = true }) {
  const root = new THREE.Group();
  root.name = "building";
  addSite(root, { size: Math.max(w, d) * 2.6 + offsets.length * 18, seed, water: true });
  const podW = offsets.length > 1 ? w * offsets.length + 16 : w + 8;
  const base = addPodium(root, { w: podW, d: d + 8, floors: 2 });
  const maxFloors = Math.max(...offsets.map((o) => o.floors));
  for (let f = 1; f <= maxFloors; f++) {
    const b = new Bucket(`floor-${f}`);
    for (const o of offsets) {
      if (f > o.floors) continue;
      storey(b, { w, d, y: base + (f - 1) * h, h, cx: o.x, cz: o.z, balconies: balconies && f > 1, finEvery: 3 });
    }
    root.add(b.build());
  }
  const roof = new Bucket("roof");
  for (const o of offsets) roofInto(roof, { w, d, y: base + o.floors * h, cx: o.x, cz: o.z });
  root.add(roof.build());
  return root;
}

function courtyard({ floors = 16, h = 3.2, seed = 2 }) {
  // U-shaped mid-rise block around a landscaped courtyard
  const root = new THREE.Group();
  root.name = "building";
  addSite(root, { size: 120, seed });
  const base = addPodium(root, { w: 66, d: 14, floors: 1 });
  const wings = [
    { w: 60, d: 14, x: 0, z: -22 },
    { w: 14, d: 34, x: -23, z: 2 },
    { w: 14, d: 34, x: 23, z: 2 },
  ];
  for (let f = 1; f <= floors; f++) {
    const b = new Bucket(`floor-${f}`);
    for (const wg of wings) storey(b, { w: wg.w, d: wg.d, y: base + (f - 1) * h, h, cx: wg.x, cz: wg.z, mullion: 2.4, finEvery: 4, balconies: false });
    root.add(b.build());
  }
  const r = new Bucket("roof");
  for (const wg of wings) {
    r.box(M.stone, wg.w + 0.3, 0.6, wg.d + 0.3, wg.x, base + floors * h, wg.z);
    r.box(M.gold, wg.w + 0.3, 0.2, 0.2, wg.x, base + floors * h + 0.6, wg.z + wg.d / 2);
  }
  // courtyard garden
  r.box(M.grass, 30, 0.06, 26, 0, 0.01, 6);
  root.add(r.build());
  return root;
}

function business({ floors = 18, h = 3.8, seed = 3 }) {
  // fully glazed office tower with setbacks and a lit crown
  const root = new THREE.Group();
  root.name = "building";
  addSite(root, { size: 90, seed, water: true });
  const base = addPodium(root, { w: 40, d: 30, floors: 2, h: 5 });
  for (let f = 1; f <= floors; f++) {
    const b = new Bucket(`floor-${f}`);
    const setback = f > floors - 3 ? 4 : f > floors - 7 ? 2 : 0;
    storey(b, { w: 28 - setback * 2, d: 24 - setback * 2, y: base + (f - 1) * h, h, mullion: 1.6, finEvery: 2, glass: M.glassDark, inset: 0.2 });
    root.add(b.build());
  }
  addRoof(root, { w: 20, d: 16, y: base + floors * h });
  return root;
}

function heritage({ floors = 9, h = 3.4, seed = 4 }) {
  // low/mid-rise with pointed arches (pishtaq), brick and turquoise dome — Samarkand / Bukhara mood
  const root = new THREE.Group();
  root.name = "building";
  addSite(root, { size: 100, seed });
  const W = 46;
  const D = 18;
  const base = addPodium(root, { w: W + 4, d: D + 4, floors: 1, h: 5 });
  const arch = (b, x, y, z, aw, ah, depth, rotY = 0) => {
    const s = new THREE.Shape();
    s.moveTo(-aw / 2 - 0.4, 0);
    s.lineTo(aw / 2 + 0.4, 0);
    s.lineTo(aw / 2 + 0.4, ah + 0.6);
    s.lineTo(-aw / 2 - 0.4, ah + 0.6);
    s.lineTo(-aw / 2 - 0.4, 0);
    const hole = new THREE.Path();
    hole.moveTo(-aw / 2, 0);
    hole.lineTo(aw / 2, 0);
    hole.lineTo(aw / 2, ah * 0.62);
    hole.quadraticCurveTo(aw / 2, ah * 0.9, 0, ah);
    hole.quadraticCurveTo(-aw / 2, ah * 0.9, -aw / 2, ah * 0.62);
    hole.lineTo(-aw / 2, 0);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
    g.rotateY(rotY);
    g.translate(x, y, z);
    b.add(M.brick, g);
  };
  for (let f = 1; f <= floors; f++) {
    const b = new Bucket(`floor-${f}`);
    const y = base + (f - 1) * h;
    b.box(M.stone, W + 0.4, 0.3, D + 0.4, 0, y, 0);
    b.box(M.glass, W - 1.2, h - 0.3, D - 1.2, 0, y + 0.3, 0);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / n;
      arch(b, x, y + 0.3, D / 2 - 0.2, W / n - 1.4, h - 1.1, 0.6);
      arch(b, x, y + 0.3, -D / 2 - 0.4, W / n - 1.4, h - 1.1, 0.6);
    }
    // tile band
    b.box(M.tile, W + 0.5, 0.18, D + 0.5, 0, y + h - 0.3, 0);
    root.add(b.build());
  }
  const r = new Bucket("roof");
  const top = base + floors * h;
  r.box(M.brick, W + 0.4, 0.8, D + 0.4, 0, top, 0);
  // central pishtaq: a tall pointed-arch portal rising above the roofline, framed with turquoise tile
  const ph = h * 3 + 4;
  const py = top - h * 3;
  const pw = 11;
  const s2 = new THREE.Shape();
  s2.moveTo(-pw / 2, 0);
  s2.lineTo(pw / 2, 0);
  s2.lineTo(pw / 2, ph);
  s2.lineTo(-pw / 2, ph);
  s2.lineTo(-pw / 2, 0);
  const hole2 = new THREE.Path();
  hole2.moveTo(-pw * 0.32, 0.2);
  hole2.lineTo(pw * 0.32, 0.2);
  hole2.lineTo(pw * 0.32, ph * 0.6);
  hole2.quadraticCurveTo(pw * 0.32, ph * 0.82, 0, ph * 0.88);
  hole2.quadraticCurveTo(-pw * 0.32, ph * 0.82, -pw * 0.32, ph * 0.6);
  hole2.lineTo(-pw * 0.32, 0.2);
  s2.holes.push(hole2);
  const pish = new THREE.ExtrudeGeometry(s2, { depth: 2.4, bevelEnabled: false, curveSegments: 16 });
  pish.translate(0, py, D / 2 - 0.2);
  r.add(M.brick, pish);
  r.box(M.tile, pw + 0.4, 0.5, 2.6, 0, py + ph, D / 2 - 0.3);
  r.box(M.tile, 0.45, ph, 2.6, pw / 2, py, D / 2 - 0.3);
  r.box(M.tile, 0.45, ph, 2.6, -pw / 2, py, D / 2 - 0.3);
  r.box(M.glass, pw * 0.6, ph * 0.6, 0.2, 0, py, D / 2 - 0.4);
  r.cyl(M.brick, 5.2, 5.2, 3.5, 0, top + 0.8, 0, 24);
  const dome = new THREE.SphereGeometry(5.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 1.25, 1);
  dome.translate(0, top + 4.3, 0);
  r.add(M.tile, dome);
  r.cyl(M.gold, 0.15, 0.3, 2.2, 0, top + 11.2, 0, 8);
  for (const x of [-W / 2 + 2, W / 2 - 2]) {
    // corner minaret-like towers (guldasta)
    r.cyl(M.brick, 1.2, 1.4, 6, x, top, D / 2 - 1, 16);
    r.cyl(M.tile, 0.01, 1.4, 1.8, x, top + 6, D / 2 - 1, 16);
  }
  root.add(r.build());
  return root;
}

// ───────────────────────────── export ─────────────────────────────

const MODELS = {
  "tower-twin": () => tower({ floors: 22, offsets: [{ x: -21, z: 0, floors: 22 }, { x: 21, z: 4, floors: 19 }], seed: 11 }),
  "tower-single": () => tower({ floors: 18, w: 32, d: 18, seed: 12 }),
  "courtyard-block": () => courtyard({ floors: 12, seed: 13 }),
  "business-tower": () => business({ floors: 18, seed: 14 }),
  "heritage-residence": () => heritage({ floors: 7, seed: 15 }),
  "family-quarter": () => tower({ floors: 16, w: 28, d: 16, offsets: [{ x: -34, z: 0, floors: 16 }, { x: 0, z: -8, floors: 14 }, { x: 34, z: 0, floors: 16 }], seed: 16 }),
};

const outDir = path.resolve(process.argv[2] ?? path.join(path.dirname(new URL(import.meta.url).pathname), "../../api/prisma/assets/models"));
fs.mkdirSync(outDir, { recursive: true });
const exporter = new GLTFExporter();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const [name, make] of Object.entries(MODELS)) {
  const scene = new THREE.Scene();
  scene.name = name;
  scene.add(make());
  const raw = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
  // optimise: index vertices, drop duplicates, quantise attributes (KHR_mesh_quantization — decoded natively by three.js, no extra decoder)
  const doc = await io.readBinary(new Uint8Array(raw));
  await doc.transform(dedup(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10 }));
  const file = path.join(outDir, `${name}.glb`);
  fs.writeFileSync(file, Buffer.from(await io.writeBinary(doc)));
  let tris = 0;
  scene.traverse((o) => o.isMesh && (tris += o.geometry.attributes.position.count / 3));
  console.log(`✓ ${name}.glb  ${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB  ${Math.round(tris / 1000)}k tris`);
}
