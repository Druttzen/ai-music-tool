/**
 * One-shot desktop startup install: missing sidecar extras + Canvas addon.
 */
import { isDesktopAddonHost, getCanvasAddonStatus, installCanvasAddon } from "./canvas-addon-client";
import {
  fetchSidecarHealthAfterExtraInstall,
  installSidecarExtra,
  probeSidecarExtraInstallEnv,
  sidecarExtraInstallCompleted,
  sidecarExtraInstallEnvAllowsPip,
  subscribeSidecarExtraInstallProgress,
  waitForSidecarExtraReady,
} from "./sidecar-extra-install-client";
import { fetchSidecarHealthInventory, waitForSidecar } from "./sidecar-bridge";
import {
  buildStartupInstallJobs,
  computeStartupInstallSnapshot,
  listMissingSidecarExtrasForInstall,
  parsePipProgressBytes,
  shouldSkipStartupAddonInstall,
  SIDECAR_EXTRAS_CHANGED_EVENT,
} from "./sidecar-startup-install";

export { SIDECAR_EXTRAS_CHANGED_EVENT };

export const STARTUP_INSTALL_INITIAL = {
  open: false,
  phase: "idle",
  percent: 0,
  etaLabel: "",
  sizeLabel: "",
  statusLine: "",
  detailLine: "",
  currentTitle: "",
  completedCount: 0,
  totalCount: 0,
  errors: [],
  jobs: [],
  dismissable: false,
};

function emitExtrasChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SIDECAR_EXTRAS_CHANGED_EVENT));
}

function progressFromPayload(payload) {
  if (!payload || typeof payload !== "object") return { extraId: "", line: "", parsedBytes: null };
  const extraId = String(payload.extraId || payload.extra_id || "");
  const line = String(payload.line || "").trim();
  const parsed =
    typeof payload.parsedBytes === "number"
      ? payload.parsedBytes
      : typeof payload.parsed_bytes === "number"
        ? payload.parsed_bytes
        : parsePipProgressBytes(line);
  return { extraId, line, parsedBytes: parsed };
}

function jobOk(job, result) {
  if (job.kind === "canvas") {
    return Boolean(result?.ok || result?.alreadyInstalled || result?.mode === "installed");
  }
  return sidecarExtraInstallCompleted(result) || Boolean(result?.ok);
}

/**
 * @param {typeof STARTUP_INSTALL_INITIAL} state
 * @param {Partial<typeof STARTUP_INSTALL_INITIAL>} patch
 */
function mergeState(state, patch) {
  return { ...state, ...patch };
}

/**
 * @param {{
 *   e2eFlag?: string,
 *   isDesktop?: boolean,
 *   waitForSidecar?: (ms: number) => Promise<boolean>,
 *   fetchHealth?: () => Promise<object|null>,
 *   probeEnv?: () => Promise<{ mode?: string, writable?: boolean, message?: string }>,
 *   getCanvasStatus?: () => Promise<{ installed?: boolean }>,
 *   installExtra?: (id: string) => Promise<object>,
 *   installCanvas?: () => Promise<object>,
 *   waitExtraReady?: (id: string, opts?: object) => Promise<unknown>,
 *   subscribeProgress?: (handler: Function) => () => void,
 *   now?: () => number,
 *   sleep?: (ms: number) => Promise<void>,
 *   tickMs?: number,
 * }} [deps]
 * @param {(state: object) => void} onState
 */
export async function runStartupAddonInstall(deps = {}, onState = () => {}) {
  const e2eFlag = deps.e2eFlag ?? (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_E2E : "");
  const isDesktop = deps.isDesktop ?? (typeof window !== "undefined" ? isDesktopAddonHost() : false);
  const skip = shouldSkipStartupAddonInstall({ e2eFlag, isDesktop });
  if (skip) {
    onState({ ...STARTUP_INSTALL_INITIAL, phase: "idle", open: false });
    return { skipped: true, reason: "skip-env" };
  }

  const waitSidecar = deps.waitForSidecar ?? waitForSidecar;
  const fetchHealth =
    deps.fetchHealth ??
    (async () => {
      const owned = await fetchSidecarHealthAfterExtraInstall();
      if (owned) return owned;
      return fetchSidecarHealthInventory();
    });
  const probeEnv = deps.probeEnv ?? probeSidecarExtraInstallEnv;
  const getCanvasStatus = deps.getCanvasStatus ?? getCanvasAddonStatus;
  const installExtra = deps.installExtra ?? installSidecarExtra;
  const installCanvas = deps.installCanvas ?? installCanvasAddon;
  const waitExtraReady = deps.waitExtraReady ?? waitForSidecarExtraReady;
  const subscribeProgress = deps.subscribeProgress ?? subscribeSidecarExtraInstallProgress;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const tickMs = deps.tickMs ?? 500;

  let state = {
    ...STARTUP_INSTALL_INITIAL,
    open: true,
    phase: "checking",
    statusLine: "Checking sidecar addons…",
    dismissable: false,
  };
  onState(state);

  let health = await fetchHealth().catch(() => null);
  if (!health) {
    await waitSidecar(45_000);
    health = await fetchHealth().catch(() => null);
  }
  const env = await probeEnv().catch(() => ({
    mode: "bundled-readonly",
    writable: false,
    message: "Could not probe sidecar install environment",
  }));
  let canvasInstalled = true;
  try {
    const canvas = await getCanvasStatus();
    canvasInstalled = Boolean(canvas?.installed);
  } catch {
    canvasInstalled = true;
  }

  const missingExtras = listMissingSidecarExtrasForInstall(health);
  const jobs = buildStartupInstallJobs(missingExtras, {
    includeCanvas: isDesktop,
    canvasInstalled,
  });

  if (!health && jobs.length === 0) {
    const next = mergeState(state, {
      open: true,
      phase: "blocked",
      statusLine: "Could not reach the sidecar to check addons",
      detailLine: "The app will keep working. Retry from Addons after the sidecar is running.",
      dismissable: true,
    });
    onState(next);
    return { skipped: true, reason: "no-health" };
  }

  if (!jobs.length) {
    onState({ ...STARTUP_INSTALL_INITIAL, open: false, phase: "idle" });
    return { skipped: true, reason: "all-installed" };
  }

  const pipJobs = jobs.filter((job) => job.kind === "sidecar-extra");
  const canPip = sidecarExtraInstallEnvAllowsPip(env);

  const runnable = [];
  if (canPip) {
    runnable.push(...jobs);
  } else {
    runnable.push(...jobs.filter((job) => job.kind === "canvas"));
  }

  if (!runnable.length) {
    const next = mergeState(state, {
      open: true,
      phase: "blocked",
      jobs,
      totalCount: jobs.length,
      statusLine: "Sidecar extras cannot auto-install here",
      detailLine: env?.message || "Need a writable sidecar venv (Python 3.10–3.12) or a local checkout.",
      dismissable: true,
      percent: 0,
      sizeLabel: computeStartupInstallSnapshot({ jobs, now: now() }).sizeLabel,
      etaLabel: "",
    });
    onState(next);
    return { skipped: true, reason: "blocked-env", jobs };
  }

  const completedIds = [];
  const errors = [];
  const startedAt = now();
  let currentId = null;
  let currentStartedAt = startedAt;
  let liveParsedBytes = null;
  let detailLine = "";
  let unlisten = () => {};

  const snapshotPatch = (phase, statusLine, extra = {}) => {
    const snap = computeStartupInstallSnapshot({
      jobs: runnable,
      completedIds,
      currentId,
      startedAt,
      currentStartedAt,
      now: now(),
      liveParsedBytes,
    });
    state = mergeState(state, {
      open: true,
      phase,
      jobs: runnable,
      statusLine,
      detailLine,
      currentTitle: runnable.find((job) => job.id === currentId)?.title || "",
      dismissable: false,
      percent: snap.percent,
      etaLabel: snap.etaLabel,
      sizeLabel: snap.sizeLabel,
      completedCount: snap.completedCount,
      totalCount: snap.totalCount,
      errors: [...errors],
      ...extra,
    });
    onState(state);
  };

  unlisten = subscribeProgress((payload) => {
    const parsed = progressFromPayload(payload);
    if (parsed.extraId && currentId && parsed.extraId !== currentId) return;
    if (parsed.parsedBytes != null) liveParsedBytes = parsed.parsedBytes;
    if (parsed.line) detailLine = parsed.line.slice(0, 220);
    snapshotPatch("installing", state.statusLine);
  });

  const tick = setInterval(() => {
    if (currentId) snapshotPatch("installing", state.statusLine);
  }, tickMs);

  try {
    for (let i = 0; i < runnable.length; i += 1) {
      const job = runnable[i];
      currentId = job.id;
      currentStartedAt = now();
      liveParsedBytes = null;
      detailLine = "";
      const statusLine = `Installing ${job.title} (${i + 1} of ${runnable.length})…`;
      snapshotPatch("installing", statusLine);

      let result;
      try {
        result = job.kind === "canvas" ? await installCanvas() : await installExtra(job.id);
        if (job.kind === "sidecar-extra" && result?.ok) {
          await waitExtraReady(job.id, { timeoutMs: 45_000, intervalMs: 1_000 });
        }
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }

      if (jobOk(job, result)) {
        completedIds.push(job.id);
      } else {
        const message =
          result?.error || result?.message || `Could not install ${job.title}`;
        errors.push(`${job.title}: ${message}`);
      }
      emitExtrasChanged();
    }
  } finally {
    clearInterval(tick);
    unlisten();
  }

  currentId = null;
  liveParsedBytes = null;
  const doneSnap = computeStartupInstallSnapshot({
    jobs: runnable,
    completedIds,
    startedAt,
    now: now(),
  });
  const blockedRemainder =
    !canPip && pipJobs.length
      ? env?.message || "Sidecar extras need a writable venv — they were skipped."
      : "";
  const failed = errors.length > 0 || Boolean(blockedRemainder);
  state = mergeState(state, {
    open: true,
    phase: failed ? "error" : "done",
    percent: failed ? doneSnap.percent : 100,
    etaLabel: failed ? "" : "Done",
    sizeLabel: doneSnap.sizeLabel,
    statusLine: failed
      ? "Finished with issues"
      : "All detected addons are installed",
    detailLine: [...errors, blockedRemainder].filter(Boolean).join(" · "),
    currentTitle: "",
    completedCount: completedIds.length,
    totalCount: runnable.length,
    errors,
    dismissable: true,
    jobs: runnable,
  });
  onState(state);
  emitExtrasChanged();

  if (!failed) {
    await sleep(2_000);
    onState({ ...STARTUP_INSTALL_INITIAL, open: false, phase: "idle" });
  }
  return { skipped: false, completedIds, errors, jobs: runnable };
}

let started = false;
const listeners = new Set();
let lastState = { ...STARTUP_INSTALL_INITIAL };

export function resetStartupAddonInstallForTests() {
  started = false;
  listeners.clear();
  lastState = { ...STARTUP_INSTALL_INITIAL };
}

export function subscribeAndStartStartupAddonInstall(onState, deps) {
  listeners.add(onState);
  onState(lastState);
  if (!started) {
    started = true;
    void runStartupAddonInstall(deps, (next) => {
      lastState = { ...STARTUP_INSTALL_INITIAL, ...next };
      for (const listener of [...listeners]) listener(lastState);
    });
  }
  return () => listeners.delete(onState);
}

export function dismissStartupInstall() {
  lastState = { ...lastState, open: false, dismissable: true };
  for (const listener of [...listeners]) listener(lastState);
}

if (typeof import.meta !== "undefined" && import.meta.hot) {
  import.meta.hot.dispose(() => {
    resetStartupAddonInstallForTests();
  });
}
