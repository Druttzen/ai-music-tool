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
 * Undo snapshot: slim audio peaks + include guided step, variations, and prompt history.
 * @param {object} state
 */
export function slimStateForUndo(state) {
  if (!state || typeof state !== "object") return state;
  const slim = slimStateForPersistence(state);
  return {
    ...slim,
    guidedStep: typeof state.guidedStep === "number" ? state.guidedStep : 0,
    variations: Array.isArray(state.variations) ? state.variations : [],
    history: Array.isArray(state.history) ? state.history : [],
    selectedHistoryId: state.selectedHistoryId ?? null,
  };
}

/**
 * @param {string|undefined} version
 */
export function parseVersionMajor(version) {
  const m = String(version || "").match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
}

function migrateProjectBase(raw, targetVersion) {
  if (!raw || typeof raw !== "object") return { appVersion: targetVersion };
  const next = { ...raw, appVersion: targetVersion };
  if (raw.imageAnalysis && typeof raw.imageAnalysis === "object") {
    next.imageAnalysis = { ...raw.imageAnalysis };
  }
  return next;
}

/**
 * Upgrade localStorage autosave on version bump (slim peaks; rehydrate from IndexedDB).
 * @param {object} raw
 * @param {string} targetVersion
 */
export function migratePersistedProject(raw, targetVersion) {
  const next = migrateProjectBase(raw, targetVersion);
  if (raw?.audioAnalysis) {
    next.audioAnalysis = slimAudioAnalysisForStorage(
      normalizeAudioAnalysis(raw.audioAnalysis),
    );
  }
  return next;
}

/**
 * Import / portable JSON — keep waveformPeaks when present in the file.
 * @param {object} raw
 * @param {string} targetVersion
 */
export function migrateImportedProject(raw, targetVersion) {
  const next = migrateProjectBase(raw, targetVersion);
  if (raw?.audioAnalysis) {
    next.audioAnalysis = normalizeAudioAnalysis(raw.audioAnalysis);
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
