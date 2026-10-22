import type { NextConfig } from "next";

// Cache Components is off: every screen depends on the selected role (a cookie)
// and live queue data, so pages render per request.
const nextConfig: NextConfig = {
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
