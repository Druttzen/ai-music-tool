/**
 * Fail-safe bot — Studio runtime health + re-exports Ops classifier SoT.
 * Playbooks / classifyFailureText live in fail-safe-ops/lib/classifier.js.
 */

export {
  FAILURE_PLAYBOOKS,
  classifyFailureText,
  formatAgentFixPrompt,
  formatReportSummary,
  overallSeverity,
  getActionableIssues,
  clipText,
  FAIL_SAFE_COMMENT_MAX_CHARS,
  FAIL_SAFE_LOG_EXCERPT_CHARS,
} from "../../fail-safe-ops/lib/classifier.js";

import { overallSeverity } from "../../fail-safe-ops/lib/classifier.js";

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

/**
 * Runtime health probe from sidecar state (in-app).
 * @param {{
 *   sidecarAiStatus?: string,
 *   sidecarHealth?: object|null,
 *   sidecarGenerateAvailable?: boolean,
 *   sidecarError?: string|null,
 *   appSubsystems?: {
 *     storageOk?: boolean,
 *     storageReason?: string|null,
 *     audioContextAvailable?: boolean,
 *     canvasAvailable?: boolean,
 *     localFaults?: Array<{ source?: string, message?: string }>,
 *   },
 * }} input
 * @returns {FailSafeReport}
 */
export function buildRuntimeHealthReport(input = {}) {
  const {
    sidecarAiStatus,
    sidecarHealth,
    sidecarGenerateAvailable,
    sidecarError,
    appSubsystems,
  } = input;
  /** @type {FailSafeIssue[]} */
  const issues = [];

  if (sidecarAiStatus === "offline") {
    issues.push({
      id: "sidecar_offline",
      severity: "warn",
      title: "AI sidecar offline",
      detail: sidecarError?.trim() || "Sidecar not responding — analyzers use heuristics.",
      fixCommands: ["npm run sidecar"],
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

  if (
    sidecarAiStatus === "ready" &&
    sidecarHealth &&
    sidecarHealth.librosa_available === false
  ) {
    issues.push({
      id: "sidecar_librosa_missing",
      severity: "warn",
      title: "Sidecar missing librosa",
      detail: "Health OK but librosa not available for audio analysis.",
      fixCommands: ["npm run sidecar"],
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

  if (appSubsystems && appSubsystems.storageOk === false) {
    const quota = appSubsystems.storageReason === "quota";
    issues.push({
      id: quota ? "storage_quota" : "storage_unavailable",
      severity: quota ? "fail" : "warn",
      title: quota ? "Local storage is full" : "Local storage unavailable",
      detail: quota
        ? "Saves and history may fail until you export JSON and free space."
        : "The browser blocked localStorage — session state may not persist.",
      fixCommands: [],
      safeFallback: "Export project JSON now; the rest of the studio still runs in memory.",
      docsPath: "docs/fail-safe-bot.md",
    });
  }

  if (appSubsystems && appSubsystems.audioContextAvailable === false) {
    issues.push({
      id: "audio_context",
      severity: "warn",
      title: "Web Audio is unavailable",
      detail: "This browser has no AudioContext — waveform decode and meters are skipped.",
      fixCommands: [],
      safeFallback: "Sidecar analysis and the rest of the prompt tools still work.",
      docsPath: "docs/fail-safe-bot.md",
    });
  }

  if (appSubsystems && appSubsystems.canvasAvailable === false) {
    issues.push({
      id: "canvas_unavailable",
      severity: "warn",
      title: "Canvas 2D unavailable",
      detail: "This environment cannot create a 2D canvas context.",
      fixCommands: [],
      safeFallback: "Cover/canvas tools are skipped; prompt and sidecar tools still work.",
      docsPath: "docs/fail-safe-bot.md",
    });
  }

  const localFaults = appSubsystems?.localFaults;
  if (Array.isArray(localFaults) && localFaults.length) {
    const latest = localFaults[0];
    const isReact = String(latest.source || "").startsWith("react:");
    issues.push({
      id: isReact ? "react_render" : "unhandled_exception",
      severity: isReact ? "fail" : "warn",
      title: isReact ? `UI recovered: ${latest.source}` : "Caught a runtime error",
      detail: `${latest.source || "runtime"}: ${latest.message || "unknown"}${
        localFaults.length > 1 ? ` (+${localFaults.length - 1} more)` : ""
      }`,
      fixCommands: [],
      safeFallback: "The rest of the studio should still work. Retry the last action or reload.",
      docsPath: "docs/fail-safe-bot.md",
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
