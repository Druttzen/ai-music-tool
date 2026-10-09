/**
 * One-shot desktop startup install: missing sidecar extras + Canvas addon.
 */
import { isDesktopAddonHost, getCanvasAddonStatus } from "./canvas-addon-client";
import {
  fetchSidecarHealthAfterExtraInstall,
} from "./sidecar-extra-install-client";
import { fetchSidecarHealthInventory, waitForSidecar } from "./sidecar-bridge";
import {
  buildStartupInstallJobs,
  computeStartupInstallSnapshot,
  listMissingSidecarExtrasForInstall,
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
 *   getCanvasStatus?: () => Promise<{ installed?: boolean }>,
 *   now?: () => number,
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
  const getCanvasStatus = deps.getCanvasStatus ?? getCanvasAddonStatus;
  const now = deps.now ?? Date.now;

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

  const optionalState = mergeState(state, {
    open: true,
    phase: "blocked",
    jobs,
    totalCount: jobs.length,
    statusLine: "Optional add-ons are not installed",
    detailLine: "Studio works without these downloads. Install add-ons later from Plugins when you need them.",
    dismissable: true,
    percent: 0,
    sizeLabel: computeStartupInstallSnapshot({ jobs, now: now() }).sizeLabel,
    etaLabel: "",
  });
  onState(optionalState);
  return { skipped: true, reason: "optional-addons", jobs };

  return { skipped: true, reason: "optional-addons", jobs };
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
