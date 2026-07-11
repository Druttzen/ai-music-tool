import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
    env: { ...process.env, NEXT_PUBLIC_E2E: "1" },
  },
});
