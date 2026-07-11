#!/usr/bin/env node
/**
 * Fetch Sourcery review for current branch PR and print agent-ready prompt.
 * Usage: npm run sourcery:auto
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const fetchScript = path.join(__dirname, "fetch-sourcery-review.cjs");

const r = spawnSync(process.execPath, [fetchScript], {
  cwd: root,
  encoding: "utf8",
  shell: false,
});

if (r.status !== 0) {
  process.stderr.write(r.stderr || "");
  process.exit(r.status ?? 1);
}

const review = (r.stdout || "").trim();
if (!review) {
  console.log("No Sourcery review text to send.");
  process.exit(0);
}

const prompt = `@sourcery-ai[bot] review — auto-fix all actionable issues:

${review}

Implement fixes, run npm run check:ci, commit and push to this PR branch, then summarize.`;

console.log(prompt);
