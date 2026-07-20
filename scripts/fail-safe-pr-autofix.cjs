#!/usr/bin/env node
/**
 * CI helper: run fail-safe:run on the current checkout, commit + push if dirty,
 * and print a PR comment markdown file path (or stdout).
 *
 * Env:
 *   PR_NUMBER          optional — when set, also posts a comment via gh
 *   FAIL_SAFE_MODE     fix | diagnose (default fix)
 *   GIT_USER_NAME / GIT_USER_EMAIL
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mode = process.env.FAIL_SAFE_MODE === "diagnose" ? "diagnose" : "fix";
const prNumber = process.env.PR_NUMBER || "";
const outFile = process.env.FAIL_SAFE_COMMENT_FILE || "";

function run(cmd, args, opts = {}) {
  const allowed = new Set([process.execPath, "git", "gh", "npm"]);
  if (!allowed.has(cmd)) {
    throw new Error(`fail-safe-pr-autofix: disallowed command ${cmd}`);
  }
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    ...opts,
  });
}

function git(args) {
  const r = run("git", args);
  if (r.status !== 0) throw new Error(r.stderr || `git ${args.join(" ")} failed`);
  return (r.stdout || "").trim();
}

function ensureIdentity() {
  const name = process.env.GIT_USER_NAME || "fail-safe-bot";
  const email = process.env.GIT_USER_EMAIL || "fail-safe-bot@users.noreply.github.com";
  run("git", ["config", "user.name", name]);
  run("git", ["config", "user.email", email]);
}

function commentBody({ ok, changed, branch, commit, message, details }) {
  const lines = [
    "## Fail-safe bot",
    "",
    ok ? (changed ? "**Safe auto-fix applied** and pushed to this branch." : "**Gates already green** — nothing to commit.") : "**Could not fully auto-fix** — needs agent / manual work.",
    "",
    message ? `> ${message}` : "",
    "",
    branch ? `- Branch: \`${branch}\`` : "",
    commit ? `- Commit: \`${commit}\`` : "",
    "",
    details || "",
    "",
    "---",
    "Triggers: comment `@fail-safe fix` · CI failure posts a diagnosis · `npm run fail-safe:auto` for Cursor Agent.",
    "Safe playbooks only (rust locks, eslint `--fix`, catalog import). Sourcery / logic fixes still need Agent.",
  ].filter((l) => l !== undefined);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function main() {
  ensureIdentity();
  const branch = git(["branch", "--show-current"]);

  if (mode === "diagnose") {
    const body = commentBody({
      ok: true,
      changed: false,
      branch,
      message: "Diagnosis-only mode (no auto-fix).",
    });
    if (outFile) fs.writeFileSync(outFile, body);
    else process.stdout.write(body);
    process.exit(0);
  }

  const fix = run(process.execPath, [path.join(__dirname, "fail-safe-bot.cjs")], {
    stdio: "inherit",
  });
  const fixOk = (fix.status ?? 1) === 0;
  const dirty = git(["status", "--porcelain"]);

  if (!fixOk) {
    const body = commentBody({
      ok: false,
      changed: false,
      branch,
      message: "fail-safe:run did not pass after safe auto-fixes.",
      details: "Run `npm run fail-safe:auto` and paste into Cursor Agent, or comment `@fail-safe fix` after pushing manual fixes.",
    });
    if (outFile) fs.writeFileSync(outFile, body);
    if (prNumber) {
      run("gh", ["pr", "comment", prNumber, "--body", body], { stdio: "inherit" });
    }
    process.exit(fix.status ?? 1);
  }

  if (!dirty) {
    const body = commentBody({
      ok: true,
      changed: false,
      branch,
      message: "check:ci passed with no file changes.",
    });
    if (outFile) fs.writeFileSync(outFile, body);
    if (prNumber) {
      run("gh", ["pr", "comment", prNumber, "--body", body], { stdio: "inherit" });
    }
    process.exit(0);
  }

  git(["add", "-A"]);
  git(["commit", "-m", `fix: fail-safe auto repair (${new Date().toISOString().slice(0, 10)})`]);
  const commit = git(["rev-parse", "--short", "HEAD"]);
  const push = run("git", ["push", "origin", "HEAD"], { stdio: "inherit" });
  if ((push.status ?? 1) !== 0) {
    process.exit(push.status ?? 1);
  }

  const body = commentBody({
    ok: true,
    changed: true,
    branch,
    commit,
    message: "Safe playbooks fixed the tree and re-ran check:ci.",
  });
  if (outFile) fs.writeFileSync(outFile, body);
  if (prNumber) {
    run("gh", ["pr", "comment", prNumber, "--body", body], { stdio: "inherit" });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, changed: true, branch, commit })}\n`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
