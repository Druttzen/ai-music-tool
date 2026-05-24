/** @type {import('next').NextConfig} */
const pkg = require("./package.json");
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
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