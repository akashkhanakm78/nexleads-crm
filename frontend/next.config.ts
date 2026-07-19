import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["10.255.98.154", "localhost", "127.0.0.1"],
} as any;

export default nextConfig;
