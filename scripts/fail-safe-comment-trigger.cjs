#!/usr/bin/env node
/**
 * Detect whether a PR comment should trigger fail-safe reply / autofix.
 * Used by GitHub Actions (fail-safe-pr-comments.yml).
 *
 * Usage:
 *   node scripts/fail-safe-comment-trigger.cjs --body "..." --user "login"
 *   echo '{"body":"...","user":"..."}' | node scripts/fail-safe-comment-trigger.cjs --json-in
 *
 * Prints JSON: { match, mode: "fix"|"reply"|"sourcery", reason }
 */
const fs = require("fs");

const argv = process.argv.slice(2);
let body = "";
let user = "";

if (argv.includes("--json-in")) {
  const raw = fs.readFileSync(0, "utf8");
  const parsed = JSON.parse(raw);
  body = String(parsed.body || "");
  user = String(parsed.user || parsed.login || "");
} else {
  const bi = argv.indexOf("--body");
  const ui = argv.indexOf("--user");
  if (bi >= 0) body = String(argv[bi + 1] || "");
  if (ui >= 0) user = String(argv[ui + 1] || "");
}

const lower = body.toLowerCase();
const login = user.toLowerCase();

/** @type {{ match: boolean, mode: string, reason: string }} */
let result = { match: false, mode: "none", reason: "no trigger" };

if (login === "sourcery-ai[bot]" || lower.includes("prompt for ai agents") || lower.includes("issue_to_address")) {
  result = { match: true, mode: "sourcery", reason: "Sourcery review comment" };
} else if (
  /@fail-safe\b/i.test(body) ||
  /\bfail-safe\s+fix\b/i.test(body) ||
  /\bfail-safe:\s*fix\b/i.test(body) ||
  /\bfail-safe:\s*auto\b/i.test(body) ||
  /\bfail-safe:\s*run\b/i.test(body)
) {
  const wantsFix =
    /@fail-safe\s+fix\b/i.test(body) ||
    /\bfail-safe\s+fix\b/i.test(body) ||
    /\bfail-safe:\s*(fix|run|auto)\b/i.test(body) ||
    /please\s+fix/i.test(body);
  result = {
    match: true,
    mode: wantsFix ? "fix" : "reply",
    reason: wantsFix ? "@fail-safe fix request" : "@fail-safe mention",
  };
} else if (
  /insufficient funds|insufficient_quota|out of credits/i.test(body) &&
  /review|bugbot|codex/i.test(body)
) {
  result = { match: true, mode: "fix", reason: "paid review billing failure" };
}

process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.match ? 0 : 2);
