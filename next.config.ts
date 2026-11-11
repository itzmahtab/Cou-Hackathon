import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,

  // The `pg` driver, `bcryptjs` and `jsonwebtoken` must stay external to the
  // server bundle so their native / node-only parts are not bundled.
  serverExternalPackages: ["pg", "bcryptjs", "jsonwebtoken"],

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
