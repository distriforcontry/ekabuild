import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  // separate build dir for a parallel `next dev` (NEXT_DIST_DIR=.next-dev) next to a running production build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@eka/shared"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  experimental: {
    optimizePackageImports: ["iconsax-reactjs", "lucide-react", "recharts", "@react-three/drei", "motion"],
  },
  // In production nginx routes /api/* straight to the API pool; this rewrite covers local dev
  // and any request that reaches Next directly.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
