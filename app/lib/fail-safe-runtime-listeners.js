/**
 * Fail-Safe Runtime listeners (window error / unhandledrejection).
 * Always capture locally. GitHub queue still requires enable + telemetry consent.
 */

import { captureRuntimeFault } from "./fail-safe-runtime-capture.js";

let installed = false;
let onError = null;
let onRejection = null;
/** @type {{ appVersion?: string, sidecarAiStatus?: string }} */
let metaRef = {};

function shouldIgnoreMessage(message) {
  const text = String(message || "");
  if (!text.trim()) return true;
  if (/ResizeObserver loop/i.test(text)) return true;
  if (/^Script error\.?$/i.test(text)) return true;
  return false;
}

/**
 * @param {{ appVersion?: string, sidecarAiStatus?: string }} [meta]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function installRuntimeErrorListeners(meta = {}) {
  metaRef = { ...meta };
  if (typeof window === "undefined") {
    return { ok: false, reason: "no-window" };
  }
  if (installed) {
    return { ok: true, reason: "already-installed" };
  }

  onError = (event) => {
    const message = event?.message || String(event?.error || "window error");
    if (shouldIgnoreMessage(message)) return;
    captureRuntimeFault({
      source: "window.onerror",
      message,
      stack: event?.error?.stack || "",
      appVersion: metaRef.appVersion,
      sidecarAiStatus: metaRef.sidecarAiStatus,
    });
  };

  onRejection = (event) => {
    const reason = event?.reason;
    const message = reason?.message || String(reason || "unhandledrejection");
    if (shouldIgnoreMessage(message)) return;
    captureRuntimeFault({
      source: "unhandledrejection",
      message,
      stack: reason?.stack || "",
      appVersion: metaRef.appVersion,
      sidecarAiStatus: metaRef.sidecarAiStatus,
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
