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
  const result = captureRuntimeFault({
    source,
    message: err.message,
    stack: err.stack || "",
  });
  // #region agent log
  fetch("http://127.0.0.1:7508/ingest/9c8bfb19-d6a5-4ab4-bf6e-336680cebd6d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "de2287" },
    body: JSON.stringify({
      sessionId: "de2287",
      runId: "fail-safe-gap",
      hypothesisId: "F",
      location: "fail-safe-runtime-capture.js:reportCaughtError",
      message: "runtime_fault_recorded",
      data: {
        source: String(source || ""),
        message: err.message.slice(0, 180),
        localOk: result?.local?.ok !== false,
        localReason: result?.local?.reason || null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return result;
}

/**
 * Record a failed UI/sidecar operation that did not throw (ok:false / status error).
 * @param {string} source
 * @param {unknown} message
 */
export function reportFailedOperation(source, message) {
  return reportCaughtError(source, new Error(String(message || "operation failed")));
}
