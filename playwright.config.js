import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
