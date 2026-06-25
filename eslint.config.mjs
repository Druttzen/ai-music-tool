import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "electron-dist/**",
    "dist/**",
    "next-env.d.ts",
    // Rust / Tauri build output (binary assets break the JS parser after tauri:build)
    "**/target/**",
    "src-tauri/gen/**",
    "ai-sidecar/.venv/**",
    "ai-sidecar/**/__pycache__/**",
  ]),
]);

export default eslintConfig;
