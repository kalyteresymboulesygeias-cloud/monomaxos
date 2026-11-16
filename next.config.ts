import type { NextConfig } from "next";
import { eortologioRedirects } from "./lib/eortologio";
import { imageRemotePatterns } from "./lib/images";
import { MEDIA_PROXY, R2_ORIGIN } from "./lib/media";

const nextConfig: NextConfig = {
  trailingSlash: true, // WordPress URLs end with "/"
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  images: {
    // Vercel answers /_next/image with 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
    // on this project, so optimized covers and article photos never load.
    // Serve the file URL until Image Optimization is on a paid plan.
    // remotePatterns, formats, and minimumCacheTTL stay: set unoptimized to
    // false to send traffic through the optimizer again.
    unoptimized: true,
    // AVIF when the browser accepts it, otherwise WebP, once unoptimized is false.
    formats: ["image/avif", "image/webp"],
    // Upload filenames are stable. R2 sends no Cache-Control, so without this
    // the optimizer response would keep the 4-hour default and repeat views
    // would still fail the cache audit. There is no purge API: replace a file
    // by uploading a new name (WordPress already does).
    minimumCacheTTL: 31536000,
    remotePatterns: imageRemotePatterns(),
  },
  // Yearly nameday posts point to the permanent date page once it exists.
  async redirects() {
    return eortologioRedirects();
  },
  // Some Greek mobile networks refuse *.r2.dev, so uploads are proxied same-origin.
  async rewrites() {
    return [{ source: `${MEDIA_PROXY}/:path*`, destination: `${R2_ORIGIN}/wp-content/uploads/:path*` }];
  },
  async headers() {
    return [
      {
        source: `${MEDIA_PROXY}/:path*`,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
