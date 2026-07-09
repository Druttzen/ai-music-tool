/**
 * Pure sidecar probe logic extracted from use-analyzers for testability.
 */

/**
 * @param {{ httpOk: boolean, tauriManaged?: { ready?: boolean, spawned?: boolean } | null, isTauri?: boolean }} input
 * @returns {"ready" | "standby" | "offline"}
 */
export function resolveSidecarAiStatus(input) {
  const { httpOk, tauriManaged, isTauri } = input;
  if (httpOk) return "ready";
  if (isTauri && tauriManaged?.ready) return "ready";
  if (isTauri && tauriManaged?.spawned) return "offline";
  if (isTauri) return "standby";
  return "offline";
}

/**
 * @param {{ health?: { generate_available?: boolean } | null }} input
 * @returns {boolean}
 */
export function resolveSidecarGenerateAvailable(input) {
  return !!input.health?.generate_available;
}

/**
 * @param {"ready" | "standby" | "offline"} status
 * @returns {number} ms until next probe
 */
export function sidecarProbeDelayMs(status) {
  if (status === "ready") return 30_000;
  if (status === "standby") return 5_000;
  return 2_000;
}
