/**
 * Persisted project / history helpers (localStorage size + version upgrades).
 */

import { normalizeAudioAnalysis } from "./audio-analyzer";

/**
 * Drop heavy waveform arrays from saved JSON; peaks rehydrate from IndexedDB or estimates.
 * @param {object|null} analysis
 */
export function slimAudioAnalysisForStorage(analysis) {
  if (!analysis || typeof analysis !== "object") return analysis;
  const { waveformPeaks: _peaks, ...rest } = analysis;
  return rest;
}

/**
 * @param {object} state
 */
export function slimStateForPersistence(state) {
  if (!state || typeof state !== "object") return state;
  if (!state.audioAnalysis) return state;
  return {
    ...state,
    audioAnalysis: slimAudioAnalysisForStorage(state.audioAnalysis),
  };
}

/** @param {object} state — same slimming as autosave (history snapshots). */
export function slimStateForHistory(state) {
  return slimStateForPersistence(state);
}

/**
 * @param {string|undefined} version
 */
export function parseVersionMajor(version) {
  const m = String(version || "").match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Upgrade a saved/imported project blob to the current app version without wiping presets/history.
 * @param {object} raw
 * @param {string} targetVersion
 */
export function migratePersistedProject(raw, targetVersion) {
  if (!raw || typeof raw !== "object") return { appVersion: targetVersion };

  const next = {
    ...raw,
    appVersion: targetVersion,
  };

  if (raw.audioAnalysis) {
    next.audioAnalysis = slimAudioAnalysisForStorage(
      normalizeAudioAnalysis(raw.audioAnalysis),
    );
  }

  if (raw.imageAnalysis && typeof raw.imageAnalysis === "object") {
    next.imageAnalysis = { ...raw.imageAnalysis };
  }

  return next;
}

/**
 * @param {string|undefined} savedVersion
 * @param {string} currentVersion
 */
export function shouldHardResetProjectOnVersionChange(savedVersion, currentVersion) {
  if (!savedVersion || savedVersion === currentVersion) return false;
  return parseVersionMajor(savedVersion) !== parseVersionMajor(currentVersion);
}
