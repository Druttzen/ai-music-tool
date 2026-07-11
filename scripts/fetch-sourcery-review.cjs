#!/usr/bin/env node
/**
 * Fetch latest Sourcery AI review comments from the open PR for the current branch.
 * Usage: npm run sourcery:fetch
 * Pipe to agent or: npm run sourcery:fetch > .cursor/sourcery-review.txt
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const SOURCERY = /sourcery-ai/i;

function gh(args) {
  const r = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
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
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "git command failed\n");
    process.exit(r.status ?? 1);
  }
  return r.stdout.trim();
}

function branchName() {
  return git(["branch", "--show-current"]);
}

function findOpenPr() {
  const branch = branchName();
  const json = gh([
    "pr",
    "list",
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number,url,title",
    "--limit",
    "1",
  ]);
  const list = JSON.parse(json || "[]");
  if (!list.length) {
    console.error(`No open PR for branch "${branch}".`);
    process.exit(1);
  }
  return list[0];
}

function fetchSourceryBodies(prNumber) {
  const reviews = JSON.parse(
    gh(["api", `repos/{owner}/{repo}/pulls/${prNumber}/reviews`, "--paginate"]) || "[]",
  );
  const comments = JSON.parse(
    gh(["api", `repos/{owner}/{repo}/pulls/${prNumber}/comments`, "--paginate"]) || "[]",
  );

  const chunks = [];

  for (const review of reviews) {
    if (!SOURCERY.test(review.user?.login || "")) continue;
    if (review.body?.trim()) {
      chunks.push(`## Review (${review.state || "commented"})\n\n${review.body.trim()}`);
    }
  }

  for (const c of comments) {
    if (!SOURCERY.test(c.user?.login || "")) continue;
    if (c.body?.trim()) {
      const loc = c.path ? `\n\nFile: \`${c.path}\`${c.line ? ` L${c.line}` : ""}` : "";
      chunks.push(`## Inline comment${loc}\n\n${c.body.trim()}`);
    }
  }

  const issueComments = JSON.parse(
    gh(["api", `repos/{owner}/{repo}/issues/${prNumber}/comments`, "--paginate"]) || "[]",
  );
  for (const c of issueComments) {
    if (!SOURCERY.test(c.user?.login || "")) continue;
    if (c.body?.trim()) {
      chunks.push(`## Issue comment\n\n${c.body.trim()}`);
    }
  }

  return chunks;
}

const pr = findOpenPr();
const bodies = fetchSourceryBodies(pr.number);

if (!bodies.length) {
  console.log(`PR #${pr.number} — no Sourcery comments found yet.`);
  console.log(pr.url);
  process.exit(0);
}

console.log(`# Sourcery review — PR #${pr.number}: ${pr.title}`);
console.log(pr.url);
console.log("");
console.log("Implement all actionable issues below, then run npm run check:ci and push.\n");
for (const block of bodies) {
  console.log(block);
  console.log("\n---\n");
}
