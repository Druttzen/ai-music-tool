#!/usr/bin/env node
/**
 * Deliver a Fail-Safe Runtime report payload to GitHub (maintainer machine).
 *
 * Usage:
 *   node scripts/fail-safe-runtime-deliver.cjs report.json
 *   node scripts/fail-safe-runtime-deliver.cjs report.json --branch
 *
 * Requires `gh` auth. Creates an issue with labels; optional --branch creates
 * cursor/runtime-fail-* with a report markdown file (does not push to master).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const args = process.argv.slice(2).filter((a) => a !== "--");
const wantBranch = args.includes("--branch");
const fileArg = args.find((a) => !a.startsWith("--"));

if (!fileArg) {
  console.error("Usage: node scripts/fail-safe-runtime-deliver.cjs <report.json> [--branch]");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(fileArg), "utf8"));
const title = payload.issueTitle || "[fail-safe-runtime] report";
const body = payload.issueBody || JSON.stringify(payload, null, 2);
const labels = Array.isArray(payload.labels) ? payload.labels.join(",") : "fail-safe-runtime,needs-agent";
const branch = payload.branch || `cursor/runtime-fail-${Date.now()}`;

function gh(ghArgs) {
  return spawnSync("gh", ghArgs, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
}

const create = gh([
  "issue",
  "create",
  "--title",
  title,
  "--body",
  body,
  "--label",
  labels,
]);

if (create.status !== 0) {
  // Labels may not exist yet — retry without labels.
  const retry = gh(["issue", "create", "--title", title, "--body", body]);
  if (retry.status !== 0) {
    console.error(retry.stderr || create.stderr || "gh issue create failed");
    process.exit(retry.status ?? 1);
  }
  console.log(retry.stdout.trim());
} else {
  console.log(create.stdout.trim());
}

if (wantBranch) {
  const reportPath = path.join(root, ".fail-safe-runtime-report.md");
  fs.writeFileSync(reportPath, `${body}\n`, "utf8");
  const cur = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  }).stdout?.trim();
  const checkout = spawnSync("git", ["checkout", "-B", branch], {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
    stdio: "inherit",
  });
  if (checkout.status !== 0) {
    console.error("Could not create branch", branch);
    process.exit(checkout.status ?? 1);
  }
  spawnSync("git", ["add", "--", ".fail-safe-runtime-report.md"], {
    cwd: root,
    shell: isWin,
    stdio: "inherit",
  });
  spawnSync(
    "git",
    ["commit", "-m", `chore: fail-safe runtime report (${payload.fingerprint || "err"})`],
    { cwd: root, shell: isWin, stdio: "inherit" },
  );
  console.log(`Branch ready: ${branch} (report at .fail-safe-runtime-report.md)`);
  console.log(`Push with: git push -u origin ${branch}`);
  if (cur) {
    console.log(`Return with: git checkout ${cur}`);
  }
}
