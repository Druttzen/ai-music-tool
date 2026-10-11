#!/usr/bin/env node
/**
 * Deliver a Fail-Safe Runtime report payload to GitHub (maintainer machine).
 *
 * Usage:
 *   node scripts/fail-safe-runtime-deliver.cjs report.json
 *   node scripts/fail-safe-runtime-deliver.cjs report.json --branch
 *   node scripts/fail-safe-runtime-deliver.cjs report.json --pr
 *   node scripts/fail-safe-runtime-deliver.cjs report.json --json
 *
 * Requires `gh` auth and/or AIMC_GITHUB_TOKEN / GITHUB_TOKEN for API fallback.
 * --branch creates cursor/runtime-fail-* with report markdown (does not push).
 * --pr pushes branch and opens a draft PR linked to the issue.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");
const { createDraftPullRequest, createIssue } = require("./fail-safe-runtime-github.cjs");
const { sanitizeRuntimeValue } = require("../lib/runtime-log-redaction.cjs");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2).filter((a) => a !== "--");
const wantPr = args.includes("--pr");
const wantBranch = args.includes("--branch") || wantPr;
const jsonOut = args.includes("--json");
const fileArg = args.find((a) => !a.startsWith("--"));

if (!fileArg) {
  console.error(
    "Usage: node scripts/fail-safe-runtime-deliver.cjs <report.json> [--branch] [--pr] [--json]",
  );
  process.exit(1);
}

const payload = sanitizeRuntimeValue(JSON.parse(fs.readFileSync(path.resolve(fileArg), "utf8")));
const title = payload.issueTitle || "[fail-safe-runtime] report";
const body = payload.issueBody || JSON.stringify(payload, null, 2);
const labels = Array.isArray(payload.labels) ? payload.labels : ["fail-safe-runtime", "needs-agent"];
const branch = payload.branch || `cursor/runtime-fail-${Date.now()}`;
const token =
  process.env.AIMC_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function gh(ghArgs) {
  return spawnSync("gh", ghArgs, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
}

function git(gitArgs, inherit = false) {
  return spawnSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: inherit ? "inherit" : "pipe",
  });
}

function emit(result, code = 0) {
  result = sanitizeRuntimeValue(result);
  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    if (result.message) console.log(result.message);
    if (result.issueUrl) console.log(result.issueUrl);
    if (result.prUrl) console.log(result.prUrl);
  }
  process.exit(code);
}

async function createGitHubIssue() {
  if (token) {
    try {
      const issue = await createIssue({ token, title, body, labels });
      return { issueUrl: issue.url, issueNumber: issue.number };
    } catch (err) {
      if (!process.env.FAIL_SAFE_RUNTIME_FORCE_GH) {
        /* fall through to gh CLI */
      } else {
        throw err;
      }
    }
  }

  const labelArg = labels.join(",");
  const bodyFile = path.join(os.tmpdir(), `studio-runtime-issue-${randomUUID()}.md`);
  let create;
  fs.writeFileSync(bodyFile, body, "utf8");
  try {
    create = gh(["issue", "create", "--title", title, "--body-file", bodyFile, "--label", labelArg]);
    if (create.status !== 0) {
      create = gh(["issue", "create", "--title", title, "--body-file", bodyFile]);
      if (create.status !== 0) {
        throw new Error(create.stderr || create.stdout || "gh issue create failed");
      }
    }
  } finally {
    fs.unlinkSync(bodyFile);
  }

  const issueUrl = (create.stdout || "").trim();
  const issueNumber = Number((issueUrl.match(/\/issues\/(\d+)/) || [])[1]) || null;
  return { issueUrl, issueNumber };
}

function prepareBranch(issueNumber) {
  const reportPath = path.join(root, ".fail-safe-runtime-report.md");
  fs.writeFileSync(reportPath, `${body}\n`, "utf8");

  const cur = git(["branch", "--show-current"]).stdout?.trim();
  const checkout = git(["checkout", "-b", branch], true);
  if (checkout.status !== 0) {
    throw new Error(`Could not create branch ${branch}`);
  }

  git(["add", "--", ".fail-safe-runtime-report.md"], true);
  const commit = git(
    ["commit", "-m", `chore: fail-safe runtime report (${payload.fingerprint || "err"})`],
    true,
  );
  if (commit.status !== 0) {
    throw new Error("Could not commit runtime report");
  }

  const commitSha = git(["rev-parse", "--short", "HEAD"]).stdout?.trim() || null;
  return { cur, reportPath, commitSha, issueNumber };
}

async function openDraftPr(issueNumber) {
  const prTitle = `Fail-Safe Runtime: ${title.replace(/^\[fail-safe-runtime\]\s*/i, "").slice(0, 72)}`;
  const prBody = [
    "Draft PR for Fail-Safe Runtime agent branch.",
    "",
    issueNumber ? `Closes #${issueNumber}` : "",
    "",
    `Branch: \`${branch}\``,
    "",
    "Merge only after agent fix + green CI. See docs/fail-safe-split.md.",
  ]
    .filter(Boolean)
    .join("\n");

  if (token) {
    const pr = await createDraftPullRequest({
      token,
      title: prTitle,
      body: prBody,
      head: branch,
    });
    return pr.url;
  }

  const existing = gh(["pr", "list", "--head", branch, "--json", "url", "--limit", "1"]);
  if (existing.status === 0) {
    const list = JSON.parse(existing.stdout || "[]");
    if (list[0]?.url) return list[0].url;
  }

  const bodyFile = path.join(os.tmpdir(), `studio-runtime-pr-${randomUUID()}.md`);
  fs.writeFileSync(bodyFile, prBody, "utf8");
  let create;
  try {
    create = gh(["pr", "create", "--draft", "--title", prTitle, "--body-file", bodyFile, "--head", branch]);
  } finally {
    fs.unlinkSync(bodyFile);
  }
  if (create.status !== 0) {
    throw new Error(create.stderr || create.stdout || "gh pr create failed");
  }
  return (create.stdout || "").trim();
}

async function main() {
  try {
    if (wantBranch) {
      const status = git(["status", "--porcelain", "--untracked-files=all"]);
      if (status.status !== 0 || status.stdout.trim()) {
        emit({ ok: false, stage: "worktree", message: "Save or commit existing changes before creating a report branch. No issue or push was performed." }, 1);
      }
    }
    const { issueUrl, issueNumber } = await createGitHubIssue();
    const result = {
      ok: true,
      stage: "issue",
      issueUrl,
      issueNumber,
      branch: wantBranch ? branch : null,
      prUrl: null,
      commit: null,
      message: `Created issue${issueNumber ? ` #${issueNumber}` : ""}`,
    };

    if (wantBranch) {
      const { cur, commitSha } = prepareBranch(issueNumber);
      result.stage = "branch";
      result.commit = commitSha;
      result.message = `Branch ready: ${branch} (report at .fail-safe-runtime-report.md)`;

      if (wantPr) {
        const push = git(["push", "-u", "origin", "HEAD"], true);
        if (push.status !== 0) {
          throw new Error(push.stderr || push.stdout || "git push failed");
        }
        result.prUrl = await openDraftPr(issueNumber);
        result.stage = "pr";
        result.message = `Draft PR opened for ${branch}`;
      } else if (!jsonOut) {
        console.log(`Push with: git push -u origin ${branch}`);
        if (cur) console.log(`Return with: git checkout ${cur}`);
      }
    }

    emit(result);
  } catch (err) {
    emit(
      {
        ok: false,
        stage: "error",
        message: String(err?.message || err),
      },
      1,
    );
  }
}

main();
