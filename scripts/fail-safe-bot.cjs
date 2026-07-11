#!/usr/bin/env node
/**
 * Fail-safe bot CLI — run CI gates, classify failures, attempt safe auto-fixes.
 *
 * Usage:
 *   npm run fail-safe:run           # run check:ci + auto-fix known issues once
 *   npm run fail-safe:run -- --dry  # classify only, no auto-fix
 *   npm run fail-safe:run -- --json
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { importFailSafeBot } = require("./fail-safe-bot-import.cjs");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const dryRun = process.argv.includes("--dry");
const jsonOut = process.argv.includes("--json");
const lastRunPath = path.join(root, ".fail-safe-last-run.json");

async function loadClassifier() {
  return importFailSafeBot();
}

function writeLastRun(payload) {
  try {
    fs.writeFileSync(lastRunPath, `${JSON.stringify(payload, null, 2)}\n`);
  } catch {
    /* ignore */
  }
}

function runCapture(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: isWin,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    text: `${r.stdout || ""}\n${r.stderr || ""}`.trim(),
  };
}

function runInherit(cmd, args, cwd = root) {
  return spawnSync(cmd, args, {
    cwd,
    shell: isWin,
    stdio: "inherit",
  }).status ?? 1;
}

/** @type {Record<string, () => number>} */
const AUTO_FIXERS = {
  rust_lock_drift: () => {
    console.log("\nfail-safe-bot — auto-fix: cargo build (src-tauri + dsp-core)");
    let code = runInherit("cargo", ["build"], path.join(root, "src-tauri"));
    if (code !== 0) return code;
    return runInherit("cargo", ["build"], path.join(root, "dsp-core"));
  },
  eslint: () => {
    console.log("\nfail-safe-bot — auto-fix: eslint --fix");
    return runInherit("npx", ["eslint", ".", "--fix"]);
  },
  catalog_drift: () => {
    console.log("\nfail-safe-bot — auto-fix: import awesome-suno catalog");
    return runInherit("npm", ["run", "import:awesome-suno"]);
  },
};

async function main() {
  const { classifyFailureText, formatReportSummary } = await loadClassifier();

  console.log("fail-safe-bot — running npm run check:ci …");
  const gate = runCapture("npm", ["run", "check:ci"]);

  if (gate.status === 0) {
    const ok = { ok: true, at: Date.now(), message: "check:ci passed" };
    writeLastRun(ok);
    if (jsonOut) {
      console.log(JSON.stringify(ok, null, 2));
    } else {
      console.log("\nfail-safe-bot — OK (check:ci passed)");
    }
    process.exit(0);
  }

  const issues = classifyFailureText(gate.text);
  const autoFixable = issues.filter((i) => AUTO_FIXERS[i.id]);
  const failPayload = {
    ok: false,
    at: Date.now(),
    gateExit: gate.status,
    issues,
    autoFixable: autoFixable.map((i) => i.id),
  };
  writeLastRun(failPayload);

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          gateExit: gate.status,
          issues,
          autoFixable: autoFixable.map((i) => i.id),
          logTail: gate.text.slice(-8000),
        },
        null,
        2,
      ),
    );
  } else {
    console.error("\n" + formatReportSummary({ at: Date.now(), overall: "fail", issues }));
  }

  if (dryRun || !autoFixable.length) {
    process.exit(gate.status);
  }

  for (const issue of autoFixable) {
    const fixer = AUTO_FIXERS[issue.id];
    if (!fixer) continue;
    const code = fixer();
    if (code !== 0) {
      console.error(`fail-safe-bot — auto-fix failed for ${issue.id} (exit ${code})`);
      process.exit(code);
    }
  }

  console.log("\nfail-safe-bot — re-running check:ci after auto-fix …");
  const retry = runInherit("npm", ["run", "check:ci"]);
  if (retry === 0) {
    const ok = { ok: true, at: Date.now(), message: "check:ci passed after auto-fix", autoFixed: autoFixable.map((i) => i.id) };
    writeLastRun(ok);
    console.log("\nfail-safe-bot — OK after auto-fix");
    process.exit(0);
  }

  console.error("\nfail-safe-bot — still failing after auto-fix; manual intervention needed");
  process.exit(retry || 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
