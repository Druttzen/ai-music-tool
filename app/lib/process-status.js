/** Shared operation ledger. Progress comes from work, never from elapsed time. */
let snapshot = [];
let sequence = 0;
const listeners = new Set();
const empty = [];

export const subscribeProcesses = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getProcesses = () => snapshot;
export const getServerProcesses = () => empty;

function publish() {
  for (const listener of listeners) listener();
}

/** @param {string} id */
export function dismissProcess(id) {
  snapshot = snapshot.filter((p) => p.id !== id || p.state === "running");
  publish();
}

/**
 * @typedef {{phase?: string, pct?: number|null, completed?: number|null, total?: number|null,
 * unit?: string, completedSteps?: number, totalSteps?: number}} ProcessProgress
 */

export function beginProcess(label) {
  const id = `process-${++sequence}`;
  const recent = new Set(snapshot.filter((p) => p.state !== "running").slice(-49));
  snapshot = [...snapshot.filter((p) => p.state === "running" || recent.has(p)), {
    id, label, phase: "Starting", state: "running", pct: null, startedAt: Date.now(), updatedAt: Date.now(),
  }];
  publish();
  const update = (patch) => {
    if (!snapshot.some((p) => p.id === id && p.state === "running")) return;
    snapshot = snapshot.map((p) => p.id === id && p.state === "running" ? { ...p, ...patch, updatedAt: Date.now() } : p);
    publish();
  };
  return {
    id,
    /** @param {ProcessProgress} progress */
    progress(progress) {
      const pct = Number.isFinite(progress.pct) ? Math.max(0, Math.min(100, progress.pct)) : null;
      update({ ...progress, pct });
    },
    finish(state = "done", detail = "") {
      update({ state, detail, pct: state === "done" ? 100 : null, finishedAt: Date.now() });
    },
  };
}

/**
 * @template T
 * @param {string} label
 * @param {(process: ReturnType<typeof beginProcess>) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function runProcess(label, work) {
  const process = beginProcess(label);
  process.progress({ phase: "Working", pct: null });
  try {
    const result = await work(process);
    // Some native commands report failures as values instead of throwing.
    if (result?.ok === false) process.finish("error", result.error || result.message || "Could not finish");
    else process.finish();
    return result;
  } catch (error) {
    process.finish(error?.name === "SidecarJobCancelledError" || error?.name === "AbortError" ? "cancelled" : "error",
      error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/** Subscribe before starting a native command so its first progress event is not lost. */
export async function listenProcessEvent(eventName, handler) {
  const listen = typeof window === "undefined" ? null : window.__TAURI__?.event?.listen;
  if (!listen) return () => {};
  try {
    return await listen(eventName, (event) => handler(event.payload));
  } catch {
    return () => {};
  }
}
