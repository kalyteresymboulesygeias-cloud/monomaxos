import type { NextConfig } from "next";
import { imageRemotePatterns } from "./lib/images";

const nextConfig: NextConfig = {
  trailingSlash: true, // WordPress URLs end with "/"
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  images: {
    // AVIF when the browser accepts it, otherwise WebP. Sized derivatives
    // come from /_next/image; the R2 originals stay untouched.
    formats: ["image/avif", "image/webp"],
    // Upload filenames are stable. R2 sends no Cache-Control, so without this
    // the optimizer response would keep the 4-hour default and repeat views
    // would still fail the cache audit. There is no purge API: replace a file
    // by uploading a new name (WordPress already does).
    minimumCacheTTL: 31536000,
    remotePatterns: imageRemotePatterns(),
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
