import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@numera/ui", "@numera/db", "@numera/ai"],
};

export default nextConfig;
