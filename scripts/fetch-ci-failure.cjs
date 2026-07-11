#!/usr/bin/env node
/**
 * Fetch latest failed CI workflow log for current branch / open PR.
 * Usage: npm run fail-safe:fetch-ci
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

function gh(args) {
  const r = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "gh command failed\n");
    process.exit(r.status ?? 1);
  }
  return r.stdout.trim();
}

function git(args) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "git command failed\n");
    process.exit(r.status ?? 1);
  }
  return r.stdout.trim();
}

const branch = git(["branch", "--show-current"]);
const runsJson = gh([
  "run",
  "list",
  "--branch",
  branch,
  "--limit",
  "10",
  "--json",
  "databaseId,conclusion,status,workflowName,url,headBranch,event",
]);

const runs = JSON.parse(runsJson || "[]");
const failed = runs.find(
  (r) => r.conclusion === "failure" || (r.status === "completed" && r.conclusion !== "success"),
);

if (!failed) {
  console.log(`No failed CI runs on branch "${branch}" in recent history.`);
  process.exit(0);
}

console.log(`# CI failure — ${failed.workflowName}`);
console.log(failed.url);
console.log(`Branch: ${failed.headBranch || branch}`);
console.log("");

const log = gh(["run", "view", String(failed.databaseId), "--log-failed"]);
console.log(log);
