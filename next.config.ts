import type { NextConfig } from "next";

// The GitHub Pages workflow sets GITHUB_PAGES to build a static export served
// from /illuminated-manuscript. Local dev and other hosts are unaffected.
const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: pages ? "export" : undefined,
  basePath: pages ? "/illuminated-manuscript" : undefined,
  images: { unoptimized: true },
  // Both rely on a server, which a static export does not have.
  cacheComponents: !pages,
  partialPrefetching: !pages,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
