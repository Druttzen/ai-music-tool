/**
 * Fail-Safe Runtime hibernate policy — one launch scan, then sleep until an error.
 */

export const LAUNCH_SCAN_WAIT_MS = 8_000;

let launchScanStarted = false;

/**
 * First caller in this JS session wins. Used so React Strict Mode does not double-scan.
 * @returns {boolean} true if this caller should run the launch scan
 */
export function claimLaunchScan() {
  if (launchScanStarted) return false;
  launchScanStarted = true;
  return true;
}

/** @param {{ mounted?: boolean, sidecarAiStatus?: string, alreadyClaimed?: boolean }} input */
export function shouldRunLaunchScan(input = {}) {
  if (!input.mounted || input.alreadyClaimed) return false;
  return input.sidecarAiStatus !== "checking";
}

/**
 * Wake after hibernate when sidecar newly drops offline (not the initial checking→offline hop).
 * @param {{ alreadyScanned?: boolean, previousStatus?: string, sidecarAiStatus?: string }} input
 */
export function shouldWakeForSidecarOffline(input = {}) {
  const prev = input.previousStatus;
  // alreadyScanned already skips the initial checking→offline hop before launch scan.
  // After hibernate, checking→offline must wake (sidecar spawn/health timeout).
  return Boolean(
    input.alreadyScanned &&
      input.sidecarAiStatus === "offline" &&
      prev &&
      prev !== "offline",
  );
}

export function resetLaunchScanGateForTests() {
  launchScanStarted = false;
}

/**
 * Fail-Safe strip state. Sidecar "checking" must not hide recorded errors.
 * @param {{
 *   mounted?: boolean,
 *   busy?: boolean,
 *   hibernating?: boolean,
 *   topIssue?: { title?: string } | null,
 * }} input
 */
export function resolveFailSafeStripState(input = {}) {
  const mounted = Boolean(input.mounted);
  const busy = Boolean(input.busy);
  const hibernating = Boolean(input.hibernating);
  const title = String(input.topIssue?.title || "").trim();
  if (title) {
    return { checking: false, botOnline: mounted, statusLabel: title };
  }
  if (!mounted || busy) {
    return { checking: true, botOnline: false, statusLabel: "checking…" };
  }
  return {
    checking: false,
    botOnline: true,
    statusLabel: hibernating ? "online · watching for errors" : "online · runtime health OK",
  };
}
