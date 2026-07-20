/**
 * Opt-in Fail-Safe Runtime listeners (window error / unhandledrejection).
 * Install only when enable + telemetry consent are both on.
 */

import { enqueueRuntimeReport, canQueueRuntimeReports } from "./fail-safe-runtime-reporter.js";

let installed = false;
let onError = null;
let onRejection = null;

/**
 * @param {{ appVersion?: string, sidecarAiStatus?: string }} [meta]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function installRuntimeErrorListeners(meta = {}) {
  if (typeof window === "undefined") {
    return { ok: false, reason: "no-window" };
  }
  if (!canQueueRuntimeReports()) {
    return { ok: false, reason: "reporting-disabled-or-no-consent" };
  }
  if (installed) {
    return { ok: true, reason: "already-installed" };
  }

  onError = (event) => {
    enqueueRuntimeReport({
      source: "window.onerror",
      message: event?.message || String(event?.error || "window error"),
      stack: event?.error?.stack || "",
      appVersion: meta.appVersion,
      sidecarAiStatus: meta.sidecarAiStatus,
    });
  };

  onRejection = (event) => {
    const reason = event?.reason;
    enqueueRuntimeReport({
      source: "unhandledrejection",
      message: reason?.message || String(reason || "unhandledrejection"),
      stack: reason?.stack || "",
      appVersion: meta.appVersion,
      sidecarAiStatus: meta.sidecarAiStatus,
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  installed = true;
  return { ok: true };
}

export function uninstallRuntimeErrorListeners() {
  if (typeof window === "undefined" || !installed) return;
  if (onError) window.removeEventListener("error", onError);
  if (onRejection) window.removeEventListener("unhandledrejection", onRejection);
  onError = null;
  onRejection = null;
  installed = false;
}

export function areRuntimeErrorListenersInstalled() {
  return installed;
}
