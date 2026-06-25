/**
 * Merge librosa sidecar results into the heuristic browser report shape.
 * Keeps waveform, highlight, and catalog suggestions; overrides tempo/key/centroid.
 */

import { buildAudioAnalyzerSuggestions } from "./analyzer-suggestions";
import { buildAudioAnalysisSummary, formatTime } from "./audio-analyzer";
import { clamp } from "./music-helpers";

/**
 * @param {object} report Heuristic report from {@link analyzeAudioBuffer}.
 * @param {{ duration_sec: number, tempo_bpm: number, key_estimate: string, spectral_centroid_hz: number, device: string }} sidecar
 */
export function mergeSidecarAnalysis(report, sidecar) {
  const bpm = Math.round(clamp(sidecar.tempo_bpm, 60, 200));
  const estimatedBpm = `${bpm} BPM`;
  const estimatedKey = String(sidecar.key_estimate || report.estimatedKey);
  const spectralCentroidHz = Math.round(sidecar.spectral_centroid_hz);

  const suggestions = buildAudioAnalyzerSuggestions({
    energy: report.energy,
    aggression: report.aggression,
    brightness: report.brightness,
    darkness: report.darkness,
    complexity: report.complexity,
    bpm,
    centroidHz: spectralCentroidHz,
  });

  const interpretation =
    report.energy > 70
      ? "High-impact, club-ready reference."
      : report.energy < 35
        ? "Calm, atmospheric reference."
        : "Controlled, balanced reference.";

  const trackSummary = `${interpretation} Librosa analysis estimates ${estimatedBpm} in ${estimatedKey}; peak section around ${formatTime(report.highlightStart)}. Edit tags below before merging into Suno.`;

  const next = {
    ...report,
    ...suggestions,
    duration: sidecar.duration_sec || report.duration,
    bpm,
    estimatedBpm,
    estimatedKey,
    spectralCentroidHz,
    analysisEngine: "sidecar",
    sidecarDevice: sidecar.device,
    trackSummary,
  };

  next.summary = buildAudioAnalysisSummary(next);
  return next;
}
