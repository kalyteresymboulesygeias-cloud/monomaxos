import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true, // WordPress URLs end with "/"
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
