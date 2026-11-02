import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets check builds use a separate folder so they never clobber a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
