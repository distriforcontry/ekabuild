#!/usr/bin/env node
/**
 * Post-processing of the static export (deploy/pages/build.sh):
 *  1. one shared copy of /public (renders, models, hdri, brand) at the site root; the oz/ and ru/ builds point to it
 *  2. absolute public paths ("/renders/…") get the site root prefix (basePath only covers Next's own URLs)
 *  3. API files referenced by the pages (covers, galleries, 3D models) are downloaded into <root>/files/
 *     (images as 1600px WebP) and the /api/v1/files/<id> URLs are rewritten to them
 *  4. demo-api.json: snapshot for lib/demo-api (certificate lookup by number/code, file-hash verification)
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
const OUT = args.out;
const API = args.api.replace(/\/$/, "");
const ROOT = args.root.replace(/\/$/, "");
const ORIGIN = new URL(args.site).origin;
const LOCALES = ["oz", "ru"];
const TEXT = /\.(html|txt|js|css|json|xml|webmanifest|svg)$/;

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const api = async (p) => {
  const r = await fetch(`${API}/api/v1${p}`);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
};

// 1. shared public assets
const publicEntries = await fs.readdir(args.public);
for (const l of LOCALES) for (const e of publicEntries) await fs.rm(path.join(OUT, l, e), { recursive: true, force: true });

// 3a. collect API file ids
const files = (await walk(OUT)).filter((f) => TEXT.test(f));
const FILE_RE = /\/api\/v1\/files\/([a-z0-9]{20,32})(\?[^"'\s\\)<>]*)?/g;
const ids = new Set();
for (const f of files) for (const m of (await fs.readFile(f, "utf8")).matchAll(FILE_RE)) ids.add(m[1]);

const EXT = { "model/gltf-binary": "glb", "model/gltf+json": "gltf", "application/pdf": "pdf", "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const saved = new Map();
await fs.mkdir(path.join(OUT, "files"), { recursive: true });
for (const id of ids) {
  const head = await fetch(`${API}/api/v1/files/${id}`);
  if (!head.ok) continue; // locked documents stay behind the paywall in the demo too
  const mime = (head.headers.get("content-type") ?? "").split(";")[0];
  let body = Buffer.from(await head.arrayBuffer());
  let ext = EXT[mime] ?? "bin";
  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    const webp = await fetch(`${API}/api/v1/files/${id}?w=1600`);
    if (webp.ok) {
      body = Buffer.from(await webp.arrayBuffer());
      ext = "webp";
    }
  }
  await fs.writeFile(path.join(OUT, "files", `${id}.${ext}`), body);
  saved.set(id, ext);
}

// 2 + 3b. rewrite URLs
const entries = publicEntries.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const PUBLIC_RE = new RegExp(`(["'\`(]|, )/(${entries})(?=[/"'\`)?])`, "g");
const ORIGIN_RE = new RegExp(`${ORIGIN.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/(${entries})(?=[/"'\`)?])`, "g");
let rewritten = 0;
for (const f of files) {
  const src = await fs.readFile(f, "utf8");
  const next = src
    .replace(FILE_RE, (m, id) => (saved.has(id) ? `${ROOT}/files/${id}.${saved.get(id)}` : m))
    .replace(PUBLIC_RE, (_m, pre, entry) => `${pre}${ROOT}/${entry}`)
    .replace(ORIGIN_RE, (_m, entry) => `${ORIGIN}${ROOT}/${entry}`);
  if (next !== src) {
    await fs.writeFile(f, next);
    rewritten++;
  }
}

// 4. demo snapshot
const { items: cards } = await api("/projects?pageSize=100");
const certificates = [];
const documents = [];
for (const c of cards) {
  const d = await api(`/projects/${encodeURIComponent(c.slug)}`);
  for (const cert of d.certificates ?? []) {
    if (!cert.code) continue;
    const r = await api(`/verify?number=${encodeURIComponent(cert.code)}`);
    certificates.push(...(r.items ?? []));
  }
  for (const doc of d.documents ?? [])
    if (doc.sha256) documents.push({ sha256: doc.sha256, title: doc.title, type: doc.type, status: doc.status, issuedAt: doc.issuedAt, number: doc.number, project: { slug: d.slug, name: d.name } });
}
await fs.writeFile(path.join(OUT, "demo-api.json"), JSON.stringify({ generatedAt: new Date().toISOString(), certificates, documents }));

console.log(`  shared public: ${publicEntries.join(", ")} · API files: ${saved.size}/${ids.size} · rewritten files: ${rewritten} · snapshot: ${certificates.length} certificates, ${documents.length} documents`);
