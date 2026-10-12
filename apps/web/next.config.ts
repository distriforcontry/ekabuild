import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@eka/shared"],
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@react-three/drei"],
  },
  // In production nginx routes /api/* straight to the API pool; this rewrite covers local dev
  // and any request that reaches Next directly.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
