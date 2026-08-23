/**
 * End-user Fail-Safe remediations that never touch git / GitHub.
 * Maintainer Fix & push stays a separate path.
 */

import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "./vocal-embed-handoff.js";
import { clearLocalFaults } from "./fail-safe-runtime-fault.js";
import { clearRuntimeReportQueue } from "./fail-safe-runtime-reporter.js";
import { collectAppSubsystemSnapshot } from "./fail-safe-app-probes.js";
import { FAIL_SAFE_STORAGE_KEY } from "./fail-safe-bot.js";
import { safeLocalStorage } from "./safe-local-storage.js";

/** Error boundaries listen for this and retry their region. */
export const FAIL_SAFE_RETRY_UI_EVENT = "aimc:fail-safe-retry-ui";

const SAFE_SCRATCH_PREFIXES = ["aimc.failSafeRuntime.", "aimc.failSafeBot."];
const SAFE_SCRATCH_KEYS = new Set([
  FAIL_SAFE_STORAGE_KEY,
  VOCAL_ALIGN_PREVIEW_STORAGE_KEY,
]);

const SIDECAR_WAIT_MS = 20_000;

/**
 * @param {string} key
 */
export function isSafeScratchStorageKey(key) {
  const k = String(key || "");
  if (!k) return false;
  if (SAFE_SCRATCH_KEYS.has(k)) return true;
  return SAFE_SCRATCH_PREFIXES.some((prefix) => k.startsWith(prefix));
}

/**
 * @param {{ e2e?: boolean, issueIds?: string[], attemptedFingerprint?: string, fingerprint?: string }} input
 */
export function shouldAutoRemediate(input = {}) {
  if (input.e2e) return false;
  const ids = input.issueIds || [];
  if (!ids.length) return false;
  if (input.fingerprint && input.fingerprint === input.attemptedFingerprint) return false;
  return true;
}

function defaultListStorageKeys() {
  if (typeof localStorage === "undefined") return [];
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}

function defaultRemoveStorageKey(key) {
  return safeLocalStorage.remove(key);
}

function defaultProbeStorage() {
  const snap = collectAppSubsystemSnapshot();
  return { ok: snap.storageOk !== false && snap.storageOk !== false, reason: snap.storageReason || snap.storageReason || null };
}

function defaultRetryUi() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return false;
  }
  window.dispatchEvent(new Event(FAIL_SAFE_RETRY_UI_EVENT));
  return true;
}

async function defaultWaitForSidecar(timeoutMs) {
  const { waitForSidecar } = await import("./sidecar-bridge");
  return waitForSidecar(timeoutMs);
}

function issueIds(issues) {
  return (issues || []).map((i) => i.id).filter(Boolean);
}

/**
 * Apply local repairs for runtime health issues.
 * Never commits, pushes, or opens GitHub.
 *
 * @param {Array<{ id?: string }>} issues
 * @param {{
 *   waitForSidecar?: (ms: number) => Promise<boolean>,
 *   listStorageKeys?: () => string[],
 *   removeStorageKey?: (key: string) => unknown,
 *   probeStorage?: () => { ok: boolean, reason?: string|null },
 *   retryUi?: () => boolean,
 *   clearFaults?: () => void,
 *   clearRuntimeQueue?: () => void,
 * }} [deps]
 */
export async function remediateRuntimeIssues(issues = [], deps = {}) {
  const waitForSidecar = deps.waitForSidecar || defaultWaitForSidecar;
  const listStorageKeys = deps.listStorageKeys || defaultListStorageKeys;
  const removeStorageKey = deps.removeStorageKey || defaultRemoveStorageKey;
  const probeStorage = deps.probeStorage || defaultProbeStorage;
  const retryUi = deps.retryUi || defaultRetryUi;
  const clearFaults = deps.clearFaults || clearLocalFaults;
  const clearRuntimeQueue = deps.clearRuntimeQueue || clearRuntimeReportQueue;

  const steps = [];
  const repaired = [];
  const remaining = [];
  const ids = [...new Set(issueIds(issues))];

  for (const id of ids) {
    if (id === "sidecar_offline") {
      let ok = false;
      try {
        ok = await waitForSidecar(SIDECAR_WAIT_MS);
      } catch {
        ok = false;
      }
      steps.push({
        id,
        action: "ensure-sidecar",
        ok,
        detail: ok
          ? "Sidecar is responding again."
          : "Sidecar still offline — start it with npm run sidecar, or retry Analyze in Studio.",
      });
      (ok ? repaired : remaining).push(id);
      continue;
    }

    if (id === "storage_quota") {
      const evicted = [];
      for (const key of listStorageKeys()) {
        if (!isSafeScratchStorageKey(key)) continue;
        removeStorageKey(key);
        evicted.push(key);
      }
      try {
        clearRuntimeQueue();
      } catch {
        /* ignore */
      }
      const probe = probeStorage();
      steps.push({
        id,
        action: "evict-scratch-storage",
        ok: probe.ok,
        detail: probe.ok
          ? `Freed ${evicted.length} scratch key(s); storage accepts writes again.`
          : "Scratch data removed, but storage is still full — export project JSON and clear history.",
      });
      (probe.ok ? repaired : remaining).push(id);
      continue;
    }

    if (id === "storage_unavailable") {
      const probe = probeStorage();
      steps.push({
        id,
        action: "retry-storage",
        ok: probe.ok,
        detail: probe.ok
          ? "localStorage is writable again."
          : "localStorage is still blocked (private mode or policy).",
      });
      (probe.ok ? repaired : remaining).push(id);
      continue;
    }

    if (id === "unhandled_exception" || id === "react_render") {
      const retried = retryUi();
      try {
        clearFaults();
      } catch {
        /* ignore */
      }
      steps.push({
        id,
        action: "retry-ui",
        ok: retried,
        detail: retried
          ? "Retried crashed panels and cleared the local fault log."
          : "Could not signal panels to retry — use Retry on the recovered panel or reload.",
      });
      (retried ? repaired : remaining).push(id);
      continue;
    }

    remaining.push(id);
    steps.push({
      id,
      action: "unsupported",
      ok: false,
      detail: "No in-app repair for this issue — use the safe fallback or copy the fix commands.",
    });
  }

  const ok = remaining.length === 0;
  const message = ok
    ? repaired.length
      ? `Local repair complete (${repaired.join(", ")}).`
      : "Nothing to repair."
    : remaining.length === ids.length
      ? `Local repair could not fix: ${remaining.join(", ")}.`
      : `Repaired ${repaired.join(", ") || "none"}; still open: ${remaining.join(", ")}.`;

  return { ok, message, steps, repaired, remaining };
}
