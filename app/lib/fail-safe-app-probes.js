/**
 * Client-only studio subsystem snapshot for Fail-Safe Runtime health.
 */

import { isTauriApp } from "./dsp-bridge";
import { getLocalFaults } from "./fail-safe-runtime-fault.js";
import { safeLocalStorage } from "./safe-local-storage.js";

const STORAGE_PROBE_KEY = "aimc.failSafeRuntime.storageProbe";

/**
 * @returns {{
 *   storageOk: boolean,
 *   storageReason: string | null,
 *   audioContextAvailable: boolean,
 *   canvasAvailable: boolean,
 *   isDesktop: boolean,
 *   localFaults: object[],
 * }}
 */
export function collectAppSubsystemSnapshot() {
  if (typeof window === "undefined") {
    return {
      storageOk: true,
      storageReason: null,
      audioContextAvailable: true,
      canvasAvailable: true,
      isDesktop: false,
      localFaults: [],
    };
  }

  const probe = safeLocalStorage.set(STORAGE_PROBE_KEY, "1");
  if (probe.ok) safeLocalStorage.remove(STORAGE_PROBE_KEY);

  let audioContextAvailable = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioContextAvailable = typeof AC === "function";
  } catch {
    audioContextAvailable = false;
  }

  let canvasAvailable = true;
  try {
    const el = document.createElement("canvas");
    canvasAvailable = Boolean(el.getContext && el.getContext("2d"));
  } catch {
    canvasAvailable = false;
  }

  return {
    storageOk: probe.ok,
    storageReason: probe.ok ? null : probe.reason || "error",
    audioContextAvailable,
    canvasAvailable,
    isDesktop: isTauriApp(),
    localFaults: getLocalFaults(),
  };
}
