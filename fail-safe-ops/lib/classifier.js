/**
 * Fail-Safe Ops classifier — SOURCE OF TRUTH for playbooks and classification.
 * Studio re-exports these from app/lib/fail-safe-bot.js; do not duplicate FAILURE_PLAYBOOKS.
 */

/** @typedef {"ok"|"warn"|"fail"} FailSafeSeverity */

/**
 * @typedef {object} FailSafeIssue
 * @property {string} id
 * @property {FailSafeSeverity} severity
 * @property {string} title
 * @property {string} detail
 * @property {string[]} fixCommands
 * @property {string} [safeFallback]
 * @property {string} [docsPath]
 */

/**
 * @typedef {object} FailSafeReport
 * @property {number} at
 * @property {FailSafeSeverity} overall
 * @property {FailSafeIssue[]} issues
 * @property {Record<string, string>} [meta]
 */

/** @type {Record<string, { title: string, patterns: RegExp[], fixCommands: string[], safeFallback?: string, docsPath?: string }>} */
export const FAILURE_PLAYBOOKS = {
  rust_lock_drift: {
    title: "Rust Cargo.lock out of sync",
    patterns: [
      /cargo\.lock is out of sync/i,
      /lock file needs to be updated/i,
      /cannot update the lock file/i,
      /--locked was passed/i,
      /verify-rust-locks/i,
    ],
    fixCommands: [
      "cd src-tauri && cargo build",
      "git add src-tauri/Cargo.lock dsp-core/Cargo.lock",
      "npm run check:rust-locks",
    ],
    safeFallback: "Do not push until Cargo.lock is committed — CI tauri-smoke uses --locked.",
    docsPath: "docs/ci-reliability.md",
  },
  rust_tooling: {
    title: "Cargo/Rust toolchain missing",
    patterns: [
      /failed to run `cargo`/i,
      /'cargo' is not recognized/i,
      /program not found.*cargo/i,
    ],
    fixCommands: [
      "rustup default stable",
      "npm run check:rust-locks",
    ],
    safeFallback: "Install Rust via https://rustup.rs before building Tauri.",
    docsPath: "docs/ci-reliability.md",
  },
  rust_compile: {
    title: "Rust compile error",
    patterns: [
      /error\[E[0-9]+\]/,
      /could not compile `/i,
      /use of undeclared type/i,
      /cannot find (type|value|function|struct) `/i,
    ],
    fixCommands: ["cd src-tauri && cargo check", "npm run check:ci"],
    safeFallback: "Fix rustc errors in src-tauri — tauri-smoke runs cargo build --locked.",
    docsPath: "docs/ci-reliability.md",
  },
  eslint: {
    title: "ESLint errors",
    patterns: [/eslint/i, /max-warnings/i, /npm run lint/i],
    fixCommands: ["npx eslint . --fix", "npm run lint"],
    safeFallback: "Fix lint locally before push — check job runs eslint with zero warnings.",
  },
  vitest: {
    title: "Unit test failure",
    patterns: [/vitest/i, /npm run test/i, /FAIL\s+tests\//i, /AssertionError/i],
    fixCommands: ["npm run test"],
    safeFallback: "Run npm run test locally and fix failing specs before push.",
  },
  pytest: {
    title: "Sidecar pytest failure",
    patterns: [/pytest/i, /run-pytest-sidecar/i, /ai-sidecar\/tests/i],
    fixCommands: ["npm run test:sidecar"],
    safeFallback: "Sidecar Python tests must pass — check:full includes pytest.",
  },
  playwright: {
    title: "Playwright e2e failure",
    patterns: [/playwright/i, /test:e2e/i, /e2e subset/i],
    fixCommands: ["npm run test:e2e:subset"],
    safeFallback: "Run e2e subset locally with sidecar running (npm run sidecar).",
    docsPath: "docs/ci-reliability.md",
  },
  sidecar_offline: {
    title: "AI sidecar offline",
    patterns: [/sidecar.*offline/i, /8723\/health/i, /did not become ready/i],
    fixCommands: ["npm run sidecar", "curl -sf http://127.0.0.1:8723/health"],
    safeFallback: "Analyzers fall back to heuristic BPM/key when sidecar is offline.",
  },
  catalog_drift: {
    title: "CC0 catalog drift",
    patterns: [/awesome-suno-concepts-synced/i, /git diff --exit-code/i, /catalog matches import/i],
    fixCommands: ["npm run import:awesome-suno", "git add app/lib/awesome-suno-concepts-synced.js"],
    safeFallback: "Regenerate synced catalog before push when awesome-suno-sync CI job fails.",
  },
  build: {
    title: "Next.js / Vite build failure",
    patterns: [/npm run build/i, /Failed to compile/i, /Build error/i],
    fixCommands: ["npm run build"],
    safeFallback: "Build must pass locally — check job runs npm run build.",
  },
  ci_gate: {
    title: "CI gate failure",
    patterns: [/ci-gates — FAILED at:/i],
    fixCommands: ["npm run check:ci", "npm run fail-safe:run"],
    safeFallback: "Run npm run check:ci locally before push (or npm run hooks:install).",
    docsPath: "docs/ci-reliability.md",
  },
  unhandled_exception: {
    title: "Unhandled runtime exception",
    patterns: [/unhandledrejection/i, /window\.onerror/i, /Minified React error/i],
    fixCommands: [],
    safeFallback: "The rest of the studio should keep working — retry the last action or reload.",
    docsPath: "docs/fail-safe-bot.md",
  },
  storage_quota: {
    title: "Local storage full or unavailable",
    patterns: [/QuotaExceededError/i, /storage full/i, /local storage unavailable/i],
    fixCommands: [],
    safeFallback: "Export JSON and clear history so saves can succeed.",
    docsPath: "docs/fail-safe-bot.md",
  },
  audio_context: {
    title: "Web Audio unavailable",
    patterns: [/AudioContext is not (defined|available)/i, /webkitAudioContext/i],
    fixCommands: [],
    safeFallback: "Playback and analyzers that need Web Audio are skipped; other tools still work.",
    docsPath: "docs/fail-safe-bot.md",
  },
  studio_export: {
    title: "Studio export failed",
    patterns: [/Studio export failed/i, /Enhanced .* download/i],
    fixCommands: [],
    safeFallback: "Retry export, or save the project JSON and export from a smaller clip.",
    docsPath: "docs/fail-safe-bot.md",
  },
  react_render: {
    title: "UI panel render crash",
    patterns: [/FailSafeErrorBoundary/i, /react:left/i, /react:center/i, /react:right/i],
    fixCommands: [],
    safeFallback: "Retry the recovered panel — neighboring columns stay mounted.",
    docsPath: "docs/fail-safe-bot.md",
  },
};

/**
 * @param {string} text
 * @returns {FailSafeIssue[]}
 */
export function classifyFailureText(text) {
  const haystack = String(text || "");
  if (!haystack.trim()) return [];

  /** @type {FailSafeIssue[]} */
  const issues = [];
  const seen = new Set();

  for (const [id, book] of Object.entries(FAILURE_PLAYBOOKS)) {
    if (!book.patterns.some((re) => re.test(haystack))) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    issues.push({
      id,
      severity: "fail",
      title: book.title,
      detail: `Matched playbook: ${id}`,
      fixCommands: [...book.fixCommands],
      safeFallback: book.safeFallback,
      docsPath: book.docsPath,
    });
  }

  return issues;
}

/**
 * @param {FailSafeIssue[]} issues
 * @returns {FailSafeSeverity}
 */
export function overallSeverity(issues) {
  if (!issues.length) return "ok";
  if (issues.some((i) => i.severity === "fail")) return "fail";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  return "ok";
}

/** GitHub issue/PR/commit comment hard limit is 65536; keep a buffer. */
export const FAIL_SAFE_COMMENT_MAX_CHARS = 60_000;
/** Keep CI comments short enough for `gh api` / the comment API. */
export const FAIL_SAFE_LOG_EXCERPT_CHARS = 8_000;

/**
 * Truncate text with an omitted-count footer.
 * @param {string} text
 * @param {number} maxChars
 * @param {string} [label]
 */
export function clipText(text, maxChars, label = "truncated") {
  const s = String(text ?? "");
  if (s.length <= maxChars) return s;
  const footerFor = (omitted) => `\n\n…(${label}: omitted ${omitted} characters)`;
  let omitted = s.length - maxChars;
  let footer = footerFor(omitted);
  let budget = Math.max(0, maxChars - footer.length);
  omitted = s.length - budget;
  footer = footerFor(omitted);
  budget = Math.max(0, maxChars - footer.length);
  return `${s.slice(0, budget)}${footer}`;
}

/**
 * Format agent prompt from CI/build failure text.
 * @param {string} failureText
 * @param {{ prUrl?: string, branch?: string, excerptLog?: boolean, excerptChars?: number }} [ctx]
 */
export function formatAgentFixPrompt(failureText, ctx = {}) {
  const issues = classifyFailureText(failureText);
  const playbookLines = issues.flatMap((i) => [
    `- ${i.title}`,
    ...i.fixCommands.map((c) => `  fix: ${c}`),
    ...(i.safeFallback ? [`  fallback: ${i.safeFallback}`] : []),
  ]);
  const rawLog = String(failureText || "").trim();
  const log = ctx.excerptLog
    ? clipText(rawLog, ctx.excerptChars ?? FAIL_SAFE_LOG_EXCERPT_CHARS, "log excerpt")
    : rawLog;

  return `[FAIL-SAFE BOT — auto-fix CI/build failure]

Branch: ${ctx.branch || "(current)"}
${ctx.prUrl ? `PR: ${ctx.prUrl}\n` : ""}
Implement minimal fixes for the failure below. Run npm run check:ci after edits. Commit and push if allowed.

Classified issues:
${playbookLines.length ? playbookLines.join("\n") : "- (unclassified — diagnose from log)"}

--- failure log ---
${log}
--- end ---`;
}

/**
 * @param {FailSafeReport} report
 * @returns {string}
 */
export function formatReportSummary(report) {
  const lines = [`Fail-safe bot — ${report.overall.toUpperCase()}`, ""];
  for (const issue of report.issues || []) {
    lines.push(`[${issue.severity}] ${issue.title}`);
    if (issue.detail) lines.push(`  ${issue.detail}`);
    for (const cmd of issue.fixCommands || []) {
      lines.push(`  → ${cmd}`);
    }
    if (issue.safeFallback) lines.push(`  safe: ${issue.safeFallback}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Issues that need attention in the UI (warn/fail). */
export function getActionableIssues(issues) {
  return (issues || []).filter((i) => i.severity === "warn" || i.severity === "fail");
}
