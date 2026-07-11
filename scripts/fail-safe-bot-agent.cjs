#!/usr/bin/env node
/**
 * Fetch CI failure + format agent auto-fix prompt.
 * Usage: npm run fail-safe:auto
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { importFailSafeBot } = require("./fail-safe-bot-import.cjs");

const root = path.join(__dirname, "..");
const fetchScript = path.join(__dirname, "fetch-ci-failure.cjs");

const fetchResult = spawnSync(process.execPath, [fetchScript], {
  cwd: root,
  encoding: "utf8",
  shell: false,
  maxBuffer: 16 * 1024 * 1024,
});

const log = (fetchResult.stdout || fetchResult.stderr || "").trim();

async function main() {
  const { formatAgentFixPrompt } = await importFailSafeBot();
  const branch = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  }).stdout?.trim();

  if (!log || fetchResult.status === 0 && log.includes("No failed CI runs")) {
    console.log("No CI failure log found. Run locally: npm run fail-safe:run");
    process.exit(fetchResult.status ?? 0);
  }

  console.log(formatAgentFixPrompt(log, { branch }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
