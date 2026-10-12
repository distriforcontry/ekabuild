// Model loading: streamed download with progress → format sniffing → parse (GLB/glTF/OBJ/STL/PLY).
// Everything runs client-side; decoders are bundled (Meshopt). Draco/KTX2 need remote decoders and are
// reported as a friendly, explicit error instead of silently fetching from a CDN.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type ModelFormat = "glb" | "gltf" | "obj" | "stl" | "ply";

export type ModelSource =
  | { kind: "url"; url: string; name?: string; size?: number }
  | { kind: "files"; files: File[] };

export type LoadPhase = "download" | "parse" | "prepare";
export type LoadProgress = { phase: LoadPhase; loaded: number; total: number };

export type LoadErrorCode = "NETWORK" | "HTTP" | "FORMAT" | "DRACO" | "KTX2" | "EMPTY" | "ABORT" | "PARSE" | "FORBIDDEN" | "NOT_FOUND";

export class LoadError extends Error {
  constructor(
    public code: LoadErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface LoadResult {
  root: THREE.Object3D;
  name: string;
  format: ModelFormat;
  fileSize: number;
  downloadMs: number;
  parseMs: number;
  extensions: string[];
  extensionsRequired: string[];
  generator: string | null;
  version: string | null;
  animations: THREE.AnimationClip[];
  notes: ("mm" | "zup")[];
  cleanup: () => void;
}

export const ACCEPT = ".glb,.gltf,.obj,.stl,.ply,.bin,.png,.jpg,.jpeg,.webp,.ktx2";
export const MODEL_EXT = /\.(glb|gltf|obj|stl|ply)$/i;

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();

function sniff(buf: ArrayBuffer, name?: string): ModelFormat | null {
  const ext = name ? extOf(name) : "";
  if (ext === "glb" || ext === "gltf" || ext === "obj" || ext === "stl" || ext === "ply") return ext;
  const u8 = new Uint8Array(buf, 0, Math.min(buf.byteLength, 512));
  const head = String.fromCharCode(...u8.slice(0, 4));
  if (head === "glTF") return "glb";
  if (head.startsWith("ply")) return "ply";
  const text = new TextDecoder().decode(u8).trimStart();
  if (text.startsWith("{")) return "gltf";
  if (buf.byteLength > 84) {
    const n = new DataView(buf).getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) return "stl";
  }
  if (text.startsWith("solid")) return "stl";
  if (/^(#|v |vn |vt |o |g |mtllib|usemtl|f )/m.test(text)) return "obj";
  return null;
}

/** Reads extensionsRequired / extensionsUsed without parsing the whole file. */
function peekGltfJson(buf: ArrayBuffer, format: ModelFormat): Record<string, unknown> | null {
  try {
    if (format === "glb") {
      const dv = new DataView(buf);
      const len = dv.getUint32(12, true);
      return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
    }
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

async function download(url: string, onProgress: (p: LoadProgress) => void, signal?: AbortSignal, sizeHint?: number) {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new LoadError("ABORT", "aborted");
    throw new LoadError("NETWORK", "Network error");
  }
  if (!res.ok) {
    const code: LoadErrorCode = res.status === 403 || res.status === 401 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : "HTTP";
    throw new LoadError(code, res.statusText || `HTTP ${res.status}`, res.status);
  }
  const total = Number(res.headers.get("content-length")) || sizeHint || 0;
  if (!res.body) {
    const b = await res.arrayBuffer();
    onProgress({ phase: "download", loaded: b.byteLength, total: b.byteLength });
    return b;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let last = 0;
  for (;;) {
    let r: ReadableStreamReadResult<Uint8Array>;
    try {
      r = await reader.read();
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new LoadError("ABORT", "aborted");
      throw new LoadError("NETWORK", "Network error");
    }
    if (r.done) break;
    chunks.push(r.value);
    loaded += r.value.byteLength;
    const now = performance.now();
    if (now - last > 60) {
      last = now;
      onProgress({ phase: "download", loaded, total: Math.max(total, loaded) });
    }
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  onProgress({ phase: "download", loaded, total: loaded });
  return out.buffer;
}

async function readFile(file: File, onProgress: (p: LoadProgress) => void, signal?: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onprogress = (e) => onProgress({ phase: "download", loaded: e.loaded, total: e.total || file.size });
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(new LoadError("NETWORK", "File read error"));
    signal?.addEventListener("abort", () => {
      fr.abort();
      reject(new LoadError("ABORT", "aborted"));
    });
    fr.readAsArrayBuffer(file);
  });
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function toStandard(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const conv = (mat: THREE.Material) => {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;
      const src = mat as THREE.MeshPhongMaterial;
      const next = new THREE.MeshStandardMaterial({
        name: src.name,
        color: src.color ? src.color.clone() : new THREE.Color("#c9c4b8"),
        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        transparent: src.transparent,
        opacity: src.opacity,
        side: src.side,
        vertexColors: src.vertexColors,
        roughness: 0.65,
        metalness: 0.05,
        flatShading: src.flatShading,
      });
      mat.dispose();
      return next;
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
}

function fixUnits(root: THREE.Object3D, notes: LoadResult["notes"]) {
  const box = new THREE.Box3().setFromObject(root);
  const s = box.getSize(new THREE.Vector3());
  if (Math.max(s.x, s.y, s.z) > 1500) {
    root.scale.multiplyScalar(0.001);
    notes.push("mm");
  }
}

export async function loadModel(src: ModelSource, onProgress: (p: LoadProgress) => void, signal?: AbortSignal): Promise<LoadResult> {
  const urls: string[] = [];
  const cleanup = () => urls.forEach((u) => URL.revokeObjectURL(u));
  try {
    const t0 = performance.now();
    let buf: ArrayBuffer;
    let name: string;
    let resourcePath = "";
    const manager = new THREE.LoadingManager();

    if (src.kind === "url") {
      buf = await download(src.url, onProgress, signal, src.size);
      name = src.name || decodeURIComponent(src.url.split("?")[0]!.split("/").pop() || "model");
      if (/\.gltf$/i.test(src.url.split("?")[0]!)) resourcePath = src.url.split("?")[0]!.replace(/[^/]+$/, "");
    } else {
      const main = src.files.find((f) => MODEL_EXT.test(f.name));
      if (!main) throw new LoadError("FORMAT", "No model file");
      name = main.name;
      // sidecar files (.bin, textures) for a .gltf dropped together
      const map = new Map<string, string>();
      for (const f of src.files) {
        if (f === main) continue;
        const u = URL.createObjectURL(f);
        urls.push(u);
        map.set(f.name, u);
      }
      manager.setURLModifier((url) => {
        const base = decodeURIComponent(url.split("?")[0]!.split("/").pop() || "");
        return map.get(base) ?? url;
      });
      buf = await readFile(main, onProgress, signal);
    }
    const downloadMs = performance.now() - t0;
    if (signal?.aborted) throw new LoadError("ABORT", "aborted");
    if (!buf.byteLength) throw new LoadError("EMPTY", "Empty file");

    const format = sniff(buf, src.kind === "files" ? name : src.name);
    if (!format) throw new LoadError("FORMAT", "Unknown format");

    onProgress({ phase: "parse", loaded: 0, total: 1 });
    await nextFrame();
    const t1 = performance.now();
    const notes: LoadResult["notes"] = [];
    let root: THREE.Object3D;
    let extensions: string[] = [];
    let extensionsRequired: string[] = [];
    let generator: string | null = null;
    let version: string | null = null;
    let animations: THREE.AnimationClip[] = [];

    if (format === "glb" || format === "gltf") {
      const json = peekGltfJson(buf, format);
      if (!json) throw new LoadError("PARSE", "Invalid glTF");
      extensions = (json.extensionsUsed as string[] | undefined) ?? [];
      extensionsRequired = (json.extensionsRequired as string[] | undefined) ?? [];
      const asset = (json.asset ?? {}) as { generator?: string; version?: string };
      generator = asset.generator ?? null;
      version = asset.version ?? null;
      if (extensions.includes("KHR_draco_mesh_compression")) throw new LoadError("DRACO", "Draco");
      if (extensionsRequired.includes("KHR_texture_basisu")) throw new LoadError("KTX2", "KTX2");
      const loader = new GLTFLoader(manager);
      loader.setMeshoptDecoder(MeshoptDecoder);
      let gltf: GLTF;
      try {
        gltf = await loader.parseAsync(buf, resourcePath);
      } catch (e) {
        throw new LoadError("PARSE", (e as Error)?.message || "Parse error");
      }
      root = gltf.scene || gltf.scenes[0];
      if (!root) throw new LoadError("EMPTY", "No scene");
      animations = gltf.animations ?? [];
    } else if (format === "obj") {
      const text = new TextDecoder().decode(buf);
      try {
        root = new OBJLoader(manager).parse(text);
      } catch (e) {
        throw new LoadError("PARSE", (e as Error)?.message || "Parse error");
      }
      toStandard(root);
      fixUnits(root, notes);
    } else if (format === "stl") {
      let geo: THREE.BufferGeometry;
      try {
        geo = new STLLoader(manager).parse(buf);
      } catch (e) {
        throw new LoadError("PARSE", (e as Error)?.message || "Parse error");
      }
      if (!geo.getAttribute("normal")) geo.computeVertexNormals();
      const hasColors = Boolean((geo as THREE.BufferGeometry & { hasColors?: boolean }).hasColors);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ name: "stl", color: "#c9c4b8", roughness: 0.55, metalness: 0.05, vertexColors: hasColors }),
      );
      mesh.name = name.replace(/\.[^.]+$/, "");
      const g = new THREE.Group();
      g.name = mesh.name;
      g.rotation.x = -Math.PI / 2; // STL is Z-up by convention
      g.add(mesh);
      notes.push("zup");
      root = g;
      fixUnits(root, notes);
    } else {
      let geo: THREE.BufferGeometry;
      try {
        geo = new PLYLoader(manager).parse(buf);
      } catch (e) {
        throw new LoadError("PARSE", (e as Error)?.message || "Parse error");
      }
      const hasColor = Boolean(geo.getAttribute("color"));
      const pointCloud = !geo.index && geo.getAttribute("position").count % 3 !== 0;
      const g = new THREE.Group();
      g.name = name.replace(/\.[^.]+$/, "");
      if (pointCloud) {
        g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.02, vertexColors: hasColor, color: hasColor ? "#ffffff" : "#c9a464" })));
      } else {
        if (!geo.getAttribute("normal")) geo.computeVertexNormals();
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ name: "ply", color: hasColor ? "#ffffff" : "#c9c4b8", vertexColors: hasColor, roughness: 0.6 }),
        );
        mesh.name = g.name;
        g.add(mesh);
      }
      root = g;
      fixUnits(root, notes);
    }
    const parseMs = performance.now() - t1;
    onProgress({ phase: "prepare", loaded: 0, total: 1 });
    await nextFrame();

    return {
      root,
      name,
      format,
      fileSize: buf.byteLength,
      downloadMs,
      parseMs,
      extensions,
      extensionsRequired,
      generator,
      version,
      animations,
      notes,
      cleanup,
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}
