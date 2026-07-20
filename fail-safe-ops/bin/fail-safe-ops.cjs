#!/usr/bin/env node
/**
 * Fail-Safe Ops CLI (phase 2) — diagnose CI logs + wrap monorepo auto-fix scripts.
 *
 * Usage (from repo root):
 *   npm run fail-safe-ops -- diagnose [logfile|-]
 *   npm run fail-safe-ops -- run [--dry] [--json]
 *   npm run fail-safe-ops -- auto
 *   npm run fail-safe-ops -- fix-push
 *   npm run fail-safe-ops -- deliver-runtime <report.json>
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const opsRoot = path.join(__dirname, "..");
const repoRoot = path.join(opsRoot, "..");
const isWin = process.platform === "win32";

function runNode(scriptRel, args = []) {
  const script = path.join(repoRoot, scriptRel);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  process.exit(r.status ?? 1);
}

function runNpm(script, extraArgs = []) {
  const r = spawnSync(isWin ? "npm.cmd" : "npm", ["run", script, "--", ...extraArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  process.exit(r.status ?? 1);
}

async function diagnose(logPath) {
  let log = "";
  if (!logPath || logPath === "-") {
    log = fs.readFileSync(0, "utf8");
  } else {
    log = fs.readFileSync(path.resolve(logPath), "utf8");
  }

  const classifierUrl = pathToFileURL(path.join(repoRoot, "app/lib/fail-safe-bot.js")).href;
  const { classifyFailureText, formatReportSummary, formatAgentFixPrompt } = await import(classifierUrl);
  const issues = classifyFailureText(log);
  const report = {
    at: Date.now(),
    overall: issues.length ? "fail" : "warn",
    issues: issues.length
      ? issues
      : [
          {
            id: "unclassified",
            severity: "warn",
            title: "Unclassified CI failure",
            detail: "See log. Run fail-safe-ops run locally.",
            fixCommands: ["npm run fail-safe-ops -- run", "npm run check:ci"],
          },
        ],
  };

  const branch = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: isWin,
  }).stdout?.trim();

  console.log("## Fail-Safe Ops — diagnosis\n");
  console.log(formatReportSummary(report));
  console.log("\n---\n");
  console.log(formatAgentFixPrompt(log, { branch }));
}

function printHelp() {
  console.log(`Fail-Safe Ops (CLI-first)

Commands:
  diagnose [file|-]   Classify a CI failure log (stdin if - or omitted with pipe)
  run [--dry] [--json]  Safe auto-fix once (wraps fail-safe:run)
  auto                Fetch CI failure + agent fix prompt (wraps fail-safe:auto)
  fix-push            Maintainer fix, commit, push (wraps fail-safe:fix-push)
  deliver-runtime <json>  Create GitHub issue from a Runtime report payload file
                          Add --branch for local commit; --pr for push + draft PR

Examples:
  gh run view <id> --log-failed | npm run fail-safe-ops -- diagnose -
  npm run fail-safe-ops -- run -- --dry
  npm run fail-safe-ops -- deliver-runtime .fail-safe-runtime-report.json -- --pr
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") {
    printHelp();
    process.exit(0);
  }

  switch (cmd) {
    case "diagnose":
      await diagnose(rest[0] || "-");
      break;
    case "run":
      runNode("scripts/fail-safe-bot.cjs", rest);
      break;
    case "auto":
      runNode("scripts/fail-safe-bot-agent.cjs", rest);
      break;
    case "fix-push":
      runNode("scripts/fail-safe-fix-and-push.cjs", rest);
      break;
    case "deliver-runtime":
      runNode("scripts/fail-safe-runtime-deliver.cjs", rest);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
