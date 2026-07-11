/**
 * Fail-safe bot — classify build/CI/runtime failures and return safe playbooks.
 * Used by in-app health panel and scripts/fail-safe-bot.cjs.
 */

export const FAIL_SAFE_STORAGE_KEY = "aimc.failSafeBot.lastReport";

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
    safeFallback: "Run e2e subset locally with sidecar running (npm run sidecar:start).",
    docsPath: "docs/ci-reliability.md",
  },
  sidecar_offline: {
    title: "AI sidecar offline",
    patterns: [/sidecar.*offline/i, /8723\/health/i, /did not become ready/i],
    fixCommands: ["npm run sidecar:start", "curl -sf http://127.0.0.1:8723/health"],
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

/**
 * Runtime health probe from sidecar state (in-app).
 * @param {{
 *   sidecarAiStatus?: string,
 *   sidecarHealth?: object|null,
 *   sidecarGenerateAvailable?: boolean,
 *   sidecarError?: string|null,
 * }} input
 * @returns {FailSafeReport}
 */
export function buildRuntimeHealthReport(input = {}) {
  const { sidecarAiStatus, sidecarHealth, sidecarGenerateAvailable, sidecarError } = input;
  /** @type {FailSafeIssue[]} */
  const issues = [];

  if (sidecarAiStatus === "offline") {
    issues.push({
      id: "sidecar_offline",
      severity: "warn",
      title: "AI sidecar offline",
      detail: sidecarError?.trim() || "Sidecar not responding — analyzers use heuristics.",
      fixCommands: ["npm run sidecar:start"],
      safeFallback: "Heuristic BPM/key still works; librosa/MusicGen need sidecar.",
      docsPath: "docs/ci-reliability.md",
    });
  } else if (sidecarAiStatus === "standby") {
    issues.push({
      id: "sidecar_standby",
      severity: "ok",
      title: "AI sidecar on-demand",
      detail: "Tauri will spawn sidecar when you analyze or generate.",
      fixCommands: [],
      safeFallback: "Normal in desktop app — no action needed until first analyze.",
    });
  }

  if (sidecarAiStatus === "ready" && sidecarHealth && !sidecarHealth.librosa_available) {
    issues.push({
      id: "sidecar_librosa_missing",
      severity: "warn",
      title: "Sidecar missing librosa",
      detail: "Health OK but librosa not available for audio analysis.",
      fixCommands: ["pip install -e ai-sidecar"],
      safeFallback: "Reinstall sidecar deps or use heuristic analyzers.",
    });
  }

  if (sidecarAiStatus === "ready" && !sidecarGenerateAvailable) {
    issues.push({
      id: "musicgen_unavailable",
      severity: "ok",
      title: "MusicGen optional stack off",
      detail: "MusicGen preview requires npm run sidecar:generate extras.",
      fixCommands: ["npm run sidecar:generate"],
      safeFallback: "MusicGen is optional — other studio tools still work.",
    });
  }

  return {
    at: Date.now(),
    overall: overallSeverity(issues.filter((i) => i.severity !== "ok" || i.id === "sidecar_standby")),
    issues: issues.length ? issues : [{
      id: "runtime_ok",
      severity: "ok",
      title: "Runtime health OK",
      detail: "Sidecar and studio subsystems look healthy.",
      fixCommands: [],
    }],
    meta: {
      sidecarAiStatus: sidecarAiStatus || "unknown",
    },
  };
}

/**
 * Merge build/CI failure issues into a report.
 * @param {FailSafeReport} base
 * @param {FailSafeIssue[]} buildIssues
 * @returns {FailSafeReport}
 */
export function mergeBuildIssues(base, buildIssues) {
  const combined = [...(base.issues || []), ...buildIssues].filter(
    (i) => i.id !== "runtime_ok",
  );
  return {
    ...base,
    at: Date.now(),
    overall: overallSeverity(combined.filter((i) => i.severity !== "ok")),
    issues: combined.length ? combined : base.issues,
  };
}

/**
 * Format agent prompt from CI/build failure text.
 * @param {string} failureText
 * @param {{ prUrl?: string, branch?: string }} [ctx]
 */
export function formatAgentFixPrompt(failureText, ctx = {}) {
  const issues = classifyFailureText(failureText);
  const playbookLines = issues.flatMap((i) => [
    `- ${i.title}`,
    ...i.fixCommands.map((c) => `  fix: ${c}`),
    ...(i.safeFallback ? [`  fallback: ${i.safeFallback}`] : []),
  ]);

  return `[FAIL-SAFE BOT — auto-fix CI/build failure]

Branch: ${ctx.branch || "(current)"}
${ctx.prUrl ? `PR: ${ctx.prUrl}\n` : ""}
Implement minimal fixes for the failure below. Run npm run check:ci after edits. Commit and push if allowed.

Classified issues:
${playbookLines.length ? playbookLines.join("\n") : "- (unclassified — diagnose from log)"}

--- failure log ---
${String(failureText || "").trim()}
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

/**
 * @param {number} at — epoch ms
 * @param {number} [now] — for tests
 */
export function formatScanAge(at, now = Date.now()) {
  if (!at) return null;
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}
