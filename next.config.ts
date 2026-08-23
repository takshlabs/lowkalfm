import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const isStaticExport = isGitHubPages || process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        ...(isGitHubPages ? { assetPrefix: "/lowkalfm/" } : {}),
        images: { unoptimized: true }
      }
    : {})
};

export default nextConfig;
