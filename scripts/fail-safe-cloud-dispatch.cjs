#!/usr/bin/env node
/**
 * Trigger fail-safe cloud fix via GitHub repository_dispatch (maintainer PAT).
 * Usage: AIMC_GITHUB_TOKEN=ghp_... npm run fail-safe:fix-push:cloud
 */
const https = require("https");

const token = process.env.AIMC_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const repo = process.env.AIMC_GITHUB_REPO || "Druttzen/ai-music-tool";

if (!token) {
  console.error("Set AIMC_GITHUB_TOKEN or GITHUB_TOKEN");
  process.exit(1);
}

const body = JSON.stringify({
  event_type: "fail-safe-fix-push",
  client_payload: { source: "cli" },
});

const req = https.request(
  {
    hostname: "api.github.com",
    path: `/repos/${repo}/dispatches`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      if (res.statusCode >= 400) {
        console.error(`dispatch failed ${res.statusCode}:`, data);
        process.exit(1);
      }
      console.log(`Cloud fail-safe fix dispatched for ${repo}`);
      console.log(`https://github.com/${repo}/actions/workflows/fail-safe-auto-fix.yml`);
    });
  },
);
req.on("error", (e) => {
  console.error(e);
  process.exit(1);
});
req.write(body);
req.end();
