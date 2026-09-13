import type { NextConfig } from "next";

const isStaticExport = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true }
      }
    : {})
};

export default nextConfig;
