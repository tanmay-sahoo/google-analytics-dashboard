/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  }
];

// One-stop URL prefix toggle. The optional `basepath.config.js` file at the
// project root decides whether the app is served under a path prefix. See that
// file for usage. If the file is missing or exports an empty string, the app
// is served at the root.
let basePath = "";
try {
  const value = require("./basepath.config.js");
  if (typeof value === "string") basePath = value.trim();
} catch (error) {
  // basepath.config.js intentionally optional — no prefix when absent.
}

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Make the resolved value visible to the rest of the app (server + client + middleware)
  // via process.env.NEXT_PUBLIC_BASE_PATH. Anything that needs to manually emit
  // URLs (raw <a>, fetch, form action, window.location, NextResponse.redirect)
  // reads from there.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  },
  async redirects() {
    if (!basePath) return [];
    return [
      // Hitting the bare root sends users into the prefixed app when a prefix is configured.
      {
        source: "/",
        destination: basePath,
        basePath: false,
        permanent: false
      }
    ];
  }
};

module.exports = nextConfig;
