/**
 * Local Fail-Safe Runtime fault log — always on, no GitHub / telemetry consent.
 * GitHub queue remains opt-in via fail-safe-runtime-reporter.js.
 */

import { safeLocalStorage } from "./safe-local-storage.js";

export const LOCAL_FAULT_STORAGE_KEY = "aimc.failSafeRuntime.localFaults";

const MAX_FAULTS = 12;
const DEDUPE_MS = 15_000;

/** @type {object[] | null} */
let memory = null;
const listeners = new Set();

function load() {
  if (memory) return memory;
  const stored = safeLocalStorage.getJSON(LOCAL_FAULT_STORAGE_KEY, []);
  memory = Array.isArray(stored) ? stored : [];
  return memory;
}

function persist(next) {
  memory = next;
  safeLocalStorage.setJSON(LOCAL_FAULT_STORAGE_KEY, next);
  for (const cb of listeners) {
    try {
      cb(next);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/**
 * @returns {object[]}
 */
export function getLocalFaults() {
  return [...load()];
}

export function clearLocalFaults() {
  persist([]);
}

/**
 * @param {{ source?: string, message?: string, stack?: string, at?: number }} input
 * @returns {{ ok: boolean, reason?: string, entry?: object }}
 */
export function recordLocalFault(input = {}) {
  const at = input.at || Date.now();
  const source = String(input.source || "runtime").slice(0, 80);
  const message = String(input.message || "Unknown runtime error").slice(0, 500);
  const stack = String(input.stack || "").slice(0, 4000);
  const fingerprint = `${source}:${message}`.slice(0, 96);
  const current = load();
  const dup = current.some(
    (item) => item.fingerprint === fingerprint && Math.abs((item.at || 0) - at) < DEDUPE_MS,
  );
  if (dup) {
    return { ok: false, reason: "duplicate" };
  }
  const entry = { at, source, message, stack, fingerprint };
  persist([entry, ...current].slice(0, MAX_FAULTS));
  return { ok: true, entry };
}

/**
 * @param {(faults: object[]) => void} cb
 * @returns {() => void}
 */
export function subscribeLocalFaults(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
