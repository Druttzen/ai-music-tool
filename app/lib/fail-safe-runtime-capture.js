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
