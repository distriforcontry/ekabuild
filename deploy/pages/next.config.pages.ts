import type { NextConfig } from "next";

// Static export of the public site for GitHub Pages (used by deploy/pages/build.sh on a copy of apps/web).
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,
  distDir: ".next-pages",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@eka/shared"],
  images: { unoptimized: true },
  // the same sources are type-checked by the normal build / CI
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ["iconsax-reactjs", "lucide-react", "recharts", "@react-three/drei", "motion"],
  },
};

export default nextConfig;
