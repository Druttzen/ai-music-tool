/**
 * Reverse DNA from a loaded analyzer track — for local cover/remix generation.
 * Not a Suno paste pack; prompts stay internal to the local engine.
 */

import { buildSunoV55StyleFromAudioAnalysis } from "./audio-to-suno-style";

/**
 * @param {object|null|undefined} analysis
 * @param {{ maxPromptLen?: number }} [options]
 * @returns {{
 *   prompt: string,
 *   styleLine: string,
 *   bpm: number|null,
 *   keyScale: string,
 *   durationSec: number|null,
 *   fileName: string,
 *   negativeHints: string,
 * }}
 */
export function buildLocalTrackDna(analysis, options = {}) {
  const maxPromptLen = options.maxPromptLen ?? 280;
  const style = buildSunoV55StyleFromAudioAnalysis(analysis, { maxLen: maxPromptLen });
  const bpmRaw = Number(analysis?.estimatedBpm);
  const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? Math.round(bpmRaw) : null;
  const key = String(analysis?.estimatedKey || "").trim();
  const keyScale = key && key !== "Key unclear" ? key : "";
  const durationRaw = Number(analysis?.duration);
  const durationSec =
    Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw * 10) / 10 : null;
  const styleLine = String(style.styleLine || "").trim();
  const parts = [
    styleLine,
    "local cover remake",
    "same groove and melody character",
    bpm ? `${bpm} BPM` : "",
    keyScale ? `key ${keyScale}` : "",
  ].filter(Boolean);
  let prompt = parts.join(", ").replace(/\s+/g, " ").trim();
  if (prompt.length > maxPromptLen) {
    prompt = `${prompt.slice(0, maxPromptLen - 1).trim()}…`;
  }
  return {
    prompt,
    styleLine,
    bpm,
    keyScale,
    durationSec,
    fileName: String(analysis?.fileName || "").trim(),
    negativeHints: String(style.negativeHints || "").trim(),
  };
}

/**
 * Pick which backend to run for a local cover/remix job.
 * @param {"cover"|"remix"} mode
 * @param {{ acestep_available?: boolean, generate_available?: boolean, vocal_transform_available?: boolean }|null|undefined} health
 * @returns {{ engine: "acestep"|"musicgen-melody"|"vocal-transform"|null, reason: string }}
 */
export function resolveLocalCoverRemixEngine(mode, health) {
  const m = mode === "remix" ? "remix" : "cover";
  if (m === "remix") {
    if (health?.vocal_transform_available) {
      return { engine: "vocal-transform", reason: "stems + vocal-transform remix" };
    }
    return {
      engine: null,
      reason: "Remix needs Demucs or Mel-Band — npm run sidecar:stems / sidecar:stems-melband",
    };
  }
  if (health?.acestep_available) {
    return { engine: "acestep", reason: "ACE-Step full-song cover from track DNA" };
  }
  if (health?.generate_available) {
    return { engine: "musicgen-melody", reason: "MusicGen melody-conditioned cover clip" };
  }
  return {
    engine: null,
    reason:
      "Cover needs ACE-Step (npm run sidecar:acestep) or MusicGen (npm run sidecar:generate)",
  };
}

/**
 * Clamp cover duration for the chosen engine.
 * @param {"acestep"|"musicgen-melody"|"vocal-transform"} engine
 * @param {number|null|undefined} requestedSec
 * @param {number|null|undefined} sourceDurationSec
 */
export function resolveLocalCoverDurationSec(engine, requestedSec, sourceDurationSec) {
  const source = Number(sourceDurationSec);
  const requested = Number(requestedSec);
  if (engine === "musicgen-melody") {
    const fallback = Number.isFinite(source) && source > 0 ? Math.min(30, Math.max(8, source)) : 12;
    const sec = Number.isFinite(requested) && requested > 0 ? requested : fallback;
    return Math.min(30, Math.max(4, Math.round(sec)));
  }
  if (engine === "acestep") {
    const fallback = Number.isFinite(source) && source > 0 ? Math.min(180, Math.max(30, source)) : 60;
    const sec = Number.isFinite(requested) && requested > 0 ? requested : fallback;
    return Math.min(600, Math.max(10, Math.round(sec)));
  }
  return null;
}
