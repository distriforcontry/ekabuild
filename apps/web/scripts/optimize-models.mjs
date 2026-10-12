#!/usr/bin/env node
/**
 * Optimises GLB models for the web (pure glTF-Transform, no decoder needed in the browser):
 * dedup + weld (index vertices) + prune + KHR_mesh_quantization.
 *
 *   node apps/web/scripts/optimize-models.mjs [dir]   (default: apps/api/prisma/assets/models)
 */
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";

const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(new URL(import.meta.url).pathname), "../../api/prisma/assets/models"));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".glb"))) {
  const file = path.join(dir, f);
  const before = fs.statSync(file).size;
  const doc = await io.read(file);
  await doc.transform(dedup(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10 }));
  await io.write(file, doc);
  console.log(`✓ ${f}  ${(before / 1e6).toFixed(2)} → ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
}
