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