#!/usr/bin/env node
/**
 * Format a PR comment body from CI failure log text (stdin or file path arg).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

async function main() {
  const arg = process.argv[2];
  const log = arg && arg !== "-"
    ? fs.readFileSync(arg, "utf8")
    : fs.readFileSync(0, "utf8");

  const { classifyFailureText, formatReportSummary } = await import(
    path.join(root, "app/lib/fail-safe-bot.js"),
  );

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
            detail: "See failed job log. Run npm run fail-safe:run locally.",
            fixCommands: ["npm run fail-safe:run", "npm run check:ci"],
          },
        ],
  };

  const runUrl = process.env.RUN_URL || "";
  const lines = [
    "## Fail-safe bot — CI failure diagnosis",
    "",
    runUrl ? `Workflow run: ${runUrl}` : "",
    "",
    formatReportSummary(report),
    "",
    "---",
    "Auto-generated. Run `npm run fail-safe:auto` locally and paste into Cursor Agent for auto-fix.",
  ].filter(Boolean);

  process.stdout.write(lines.join("\n"));
}

main().catch((err) => {
  process.stderr.write(String(err?.message || err));
  process.exit(1);
});
