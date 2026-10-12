import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", worker: "src/worker/index.ts", seed: "prisma/seed.ts" },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: false,
  // bundle the workspace package, keep real deps external
  noExternal: ["@eka/shared"],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
