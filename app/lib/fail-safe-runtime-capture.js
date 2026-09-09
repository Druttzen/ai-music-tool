/**
 * Capture a runtime fault locally always; enqueue GitHub reports only when consented.
 */

import { recordLocalFault } from "./fail-safe-runtime-fault.js";
import { canQueueRuntimeReports, enqueueRuntimeReport } from "./fail-safe-runtime-reporter.js";

/**
 * @param {{ source?: string, message?: string, stack?: string, sidecarAiStatus?: string, appVersion?: string, at?: number }} input
 */
export function captureRuntimeFault(input = {}) {
  const local = recordLocalFault(input);
  let queued = { ok: false, reason: "reporting-disabled-or-no-consent" };
  if (canQueueRuntimeReports()) {
    queued = enqueueRuntimeReport(input);
  }
  return { local, queued };
}

/**
 * @param {string} source
 * @param {unknown} error
 */
export function reportCaughtError(source, error) {
  const err = error instanceof Error ? error : new Error(String(error || "error"));
  return captureRuntimeFault({
    source,
    message: err.message,
    stack: err.stack || "",
  });
}

/**
 * Record a failed UI/sidecar operation that did not throw (ok:false / status error).
 * @param {string} source
 * @param {unknown} message
 */
export function reportFailedOperation(source, message) {
  return reportCaughtError(source, new Error(String(message || "operation failed")));
}

const STATUS_FAULT_WARNING_RE =
  /fail|error|could not|couldn't|unable|timed? out|timeout|unauthorized|not responding|offline|invalid or missing|start the .{0,40}sidecar/i;

/**
 * True when a status toast should wake Fail-Safe (error tone, or a warning that is an operational failure).
 * Validation hints like "enter a prompt first" stay quiet.
 * @param {string} [type]
 * @param {unknown} [message]
 */
export function shouldRecordStatusAsFault(type, message) {
  const tone = String(type || "success");
  if (tone === "error") return true;
  if (tone !== "warning") return false;
  return STATUS_FAULT_WARNING_RE.test(String(message || ""));
}

/**
 * @param {unknown} message
 * @param {string} [type]
 */
export function reportStatusFault(message, type = "success") {
  const text = String(message || "").trim();
  const record = shouldRecordStatusAsFault(type, text);
  if (!record || !text) return { ok: false, reason: "ignored" };
  return reportCaughtError("ui.status", new Error(text));
}
