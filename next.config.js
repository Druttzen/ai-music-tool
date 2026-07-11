/** @type {import('next').NextConfig} */
const path = require("path");
const pkg = require("./package.json");
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  // Prevent Turbopack from treating `app/` as the workspace root (breaks `next` resolution).
  turbopack: {
    root: path.join(__dirname),
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_SIDECAR_URL: process.env.NEXT_PUBLIC_SIDECAR_URL || "http://127.0.0.1:8723",
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E || "",
  },
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  ...(isDev
    ? {}
    : {
        output: "export",
        assetPrefix: "./",
      }),
};

module.exports = nextConfig;