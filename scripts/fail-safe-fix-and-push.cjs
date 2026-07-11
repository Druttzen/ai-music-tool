#!/usr/bin/env node
/**
 * Run fail-safe auto-fix, commit, and push so fixes reach GitHub (→ release → auto-update).
 *
 * Usage:
 *   AIMC_FIX_PUSH=1 npm run fail-safe:fix-push
 *   node scripts/fail-safe-fix-and-push.cjs --app     (from sidecar maintainer mode)
 *   node scripts/fail-safe-fix-and-push.cjs --ci      (GitHub Actions)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const ciMode = process.argv.includes("--ci");
const appMode = process.argv.includes("--app");
const jsonOnly = process.argv.includes("--json") || appMode || ciMode;

function git(args) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || `git ${args.join(" ")} failed`);
  }
  return (r.stdout || "").trim();
}

function gh(args) {
  const r = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || `gh ${args.join(" ")} failed`);
  }
  return (r.stdout || "").trim();
}

function runInherit(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: root,
    shell: isWin,
    stdio: jsonOnly ? ["ignore", "pipe", "pipe"] : "inherit",
  }).status ?? 1;
}

function emit(result, code = 0) {
  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (result.message) {
    console.log(result.message);
  }
  process.exit(code);
}

function branchSlug() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

async function main() {
  if (!ciMode && !appMode && process.env.AIMC_FIX_PUSH !== "1") {
    emit(
      {
        ok: false,
        stage: "auth",
        message: "Set AIMC_FIX_PUSH=1, use --app (maintainer sidecar), or --ci (Actions)",
      },
      1,
    );
  }

  try {
    git(["rev-parse", "--git-dir"]);
  } catch {
    emit({ ok: false, stage: "git", message: "Not a git repository" }, 1);
  }

  const fixExit = runInherit(process.execPath, [path.join(__dirname, "fail-safe-bot.cjs")]);
  if (fixExit !== 0) {
    emit(
      {
        ok: false,
        stage: "fail-safe",
        exit: fixExit,
        message: "fail-safe:run did not pass — fix manually or paste npm run fail-safe:auto into Agent",
      },
      fixExit,
    );
  }

  const dirty = git(["status", "--porcelain"]);
  if (!dirty) {
    emit({
      ok: true,
      stage: "done",
      changed: false,
      message: "check:ci passed — no file changes to push. Users already on latest gates.",
    });
  }

  git(["add", "-u"]);

  const current = git(["branch", "--show-current"]);
  const pushMaster = process.env.AIMC_FIX_PUSH_MASTER === "1";
  let targetBranch = current;

  if ((current === "master" || current === "main") && !pushMaster) {
    targetBranch = `cursor/fail-safe-auto-${branchSlug()}`;
    git(["checkout", "-b", targetBranch]);
  }

  const commitMsg = `fix: fail-safe auto repair (${new Date().toISOString().slice(0, 10)})`;
  git(["commit", "-m", commitMsg]);
  const commit = git(["rev-parse", "--short", "HEAD"]);

  git(["push", "-u", "origin", "HEAD"]);

  let prUrl = null;
  const onMain = targetBranch === "master" || targetBranch === "main";
  if (!onMain && (ciMode || process.env.GH_TOKEN || process.env.GITHUB_TOKEN)) {
    try {
      const existing = spawnSync(
        "gh",
        ["pr", "list", "--head", targetBranch, "--json", "url", "--limit", "1"],
        { cwd: root, encoding: "utf8", shell: isWin },
      );
      const list = JSON.parse(existing.stdout || "[]");
      if (list[0]?.url) {
        prUrl = list[0].url;
      } else {
        prUrl = gh([
          "pr",
          "create",
          "--title",
          "Fail-safe auto repair",
          "--body",
          "Automated fail-safe fix from in-app maintainer or CI. Merge when green to ship via auto-update.",
          "--head",
          targetBranch,
        ]);
      }
    } catch {
      /* PR optional */
    }
  }

  emit({
    ok: true,
    stage: "done",
    changed: true,
    branch: targetBranch,
    commit,
    prUrl,
    message: onMain
      ? `Pushed to ${targetBranch} (${commit}). Tag/release to publish auto-update.`
      : `Pushed ${targetBranch} (${commit}). Merge PR to master → release → auto-update for all users.`,
  });
}

main().catch((err) => {
  emit({ ok: false, stage: "error", message: String(err?.message || err) }, 1);
});
