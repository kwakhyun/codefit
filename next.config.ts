import type { NextConfig } from "next";
// Public files without a version in their path: fresh for a day, then served from cache while
// the browser revalidates (ETag) for up to a week. A Monaco upgrade reaches everyone within that.
const REVALIDATED_ASSET = "public, max-age=86400, stale-while-revalidate=604800";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel packages its own functions; standalone is only for local/Docker hosting.
  // Next 16.3 adapter compatibility: https://github.com/vercel/next.js/issues/96646
  output: process.env.VERCEL ? undefined : "standalone",
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      // scripts/copy-monaco-assets.mjs copies Monaco to /monaco/vs and the QuickJS runtime to
      // /quickjs; only the wasm file name carries a version.
      { source: "/monaco/:path*", headers: [{ key: "Cache-Control", value: REVALIDATED_ASSET }] },
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: REVALIDATED_ASSET }] },
      { source: "/quickjs/:path*", headers: [{ key: "Cache-Control", value: REVALIDATED_ASSET }] },
      {
        // quickjs-<package version>.wasm: renamed with every upgrade, so it never changes in place.
        source: "/quickjs/:file(quickjs-\\d+\\.\\d+\\.\\d+\\.wasm)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};
export default nextConfig;
