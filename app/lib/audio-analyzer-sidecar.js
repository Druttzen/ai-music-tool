/**
 * Merge librosa sidecar results into the heuristic browser report shape.
 * Keeps waveform, highlight, and catalog suggestions; overrides tempo/key/centroid.
 */

import { buildAudioAnalyzerSuggestions } from "./analyzer-suggestions";
import { buildAudioAnalysisSummary, formatTime } from "./audio-analyzer";
import { HF_GENRE_MODEL_ID, mapHfGenrePredictionsToSuno } from "./hf-genre-map";
import { clamp, uniq } from "./music-helpers";

/**
 * Build a minimal heuristic report when the browser cannot decode audio (e.g. FLAC)
 * but the librosa sidecar can analyze the upload.
 * @param {string} fileName
 * @param {{ duration_sec: number, tempo_bpm: number, key_estimate: string, spectral_centroid_hz: number }} sidecar
 */
export function buildSidecarFallbackReport(fileName, sidecar) {
  const duration = Number(sidecar.duration_sec || 0);
  const bpm = Math.round(clamp(sidecar.tempo_bpm, 60, 200));
  const centroidHz = Math.round(sidecar.spectral_centroid_hz || 2200);
  const energy = centroidHz > 2800 ? 72 : centroidHz < 1800 ? 38 : 55;
  const suggestions = buildAudioAnalyzerSuggestions({
    energy,
    aggression: 55,
    brightness: clamp(Math.round(centroidHz / 50), 20, 90),
    darkness: 45,
    complexity: 50,
    bpm,
    centroidHz,
  });
  const highlightStart = Math.max(0, duration * 0.35);
  const highlightEnd = Math.min(duration, highlightStart + Math.max(8, duration * 0.12));
  const report = {
    version: 2,
    fileName,
    duration,
    waveformPeaks: [],
    waveformSource: "synthetic",
    energy,
    aggression: 55,
    brightness: clamp(Math.round(centroidHz / 50), 20, 90),
    darkness: 45,
    complexity: 50,
    bpm,
    estimatedBpm: `${bpm} BPM`,
    estimatedKey: String(sidecar.key_estimate || "Key unknown"),
    loudnessDb: -14,
    spectralCentroidHz: centroidHz,
    highlightStart,
    highlightEnd,
    highlightLabel: "Sidecar peak estimate",
    trackSummary: `Sidecar-only analysis (browser could not decode this codec). Librosa estimates ${bpm} BPM in ${sidecar.key_estimate || "unknown key"}. Edit tags before merging into Suno.`,
    ...suggestions,
    moodSuggestion: { energy, aggression: 55, darkness: 45, complexity: 50 },
    analysisEngine: "sidecar-fallback",
  };
  report.summary = buildAudioAnalysisSummary(report);
  return report;
}

/**
 * @param {object} report Heuristic report from {@link analyzeAudioBuffer}.
 * @param {{ duration_sec: number, tempo_bpm: number, key_estimate: string, key_confidence?: number, spectral_centroid_hz: number, spectral_bandwidth_hz?: number, spectral_rolloff_hz?: number, onset_strength?: number, beat_count?: number, beat_density?: number, percussive_ratio?: number, harmonic_ratio?: number, device: string, genre_predictions?: { label: string, score: number }[], genre_model?: string }} sidecar
 */
export function mergeSidecarAnalysis(report, sidecar) {
  const bpm = Math.round(clamp(sidecar.tempo_bpm, 60, 200));
  const estimatedBpm = `${bpm} BPM`;
  const estimatedKey = String(sidecar.key_estimate || report.estimatedKey);
  const spectralCentroidHz = Math.round(sidecar.spectral_centroid_hz);
  const keyConfidence = Number.isFinite(sidecar.key_confidence)
    ? clamp(Math.round(sidecar.key_confidence * 100), 0, 100)
    : null;
  const percussiveRatio = Number.isFinite(sidecar.percussive_ratio)
    ? clamp(Math.round(sidecar.percussive_ratio * 100), 0, 100)
    : null;
  const harmonicRatio = Number.isFinite(sidecar.harmonic_ratio)
    ? clamp(Math.round(sidecar.harmonic_ratio * 100), 0, 100)
    : null;
  const beatDensity = Number.isFinite(sidecar.beat_density) ? sidecar.beat_density : null;

  const mlGenres = sidecar.genre_predictions?.length
    ? mapHfGenrePredictionsToSuno(sidecar.genre_predictions)
    : null;

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

  const topGenrePct =
    mlGenres?.topScore != null ? Math.round(mlGenres.topScore * 100) : null;

  const trackSummary = mlGenres?.topGenre
    ? `${interpretation} Librosa: ${estimatedBpm} in ${estimatedKey}${keyConfidence != null ? ` (${keyConfidence}% key confidence)` : ""}; HF genre ${mlGenres.topGenre}${topGenrePct != null ? ` (${topGenrePct}%)` : ""}. ${percussiveRatio != null ? `Percussive ${percussiveRatio}%, harmonic ${harmonicRatio}%. ` : ""}Peak section around ${formatTime(report.highlightStart)}. Edit tags before merging into Suno.`
    : `${interpretation} Librosa analysis estimates ${estimatedBpm} in ${estimatedKey}${keyConfidence != null ? ` (${keyConfidence}% key confidence)` : ""}; ${percussiveRatio != null ? `percussive ${percussiveRatio}%, harmonic ${harmonicRatio}%. ` : ""}Peak section around ${formatTime(report.highlightStart)}. Edit tags below before merging into Suno.`;

  const suggestedGenres =
    mlGenres?.suggestedGenres?.length > 0
      ? mlGenres.suggestedGenres
      : suggestions.suggestedGenres;
  const sidecarRhythms = [
    beatDensity != null && beatDensity > 2.4 ? "Dense pulse" : "",
    percussiveRatio != null && percussiveRatio > 55 ? "Percussive groove" : "",
  ].filter(Boolean);
  const sidecarSounds = [
    harmonicRatio != null && harmonicRatio > 55 ? "Harmonic bed" : "",
    percussiveRatio != null && percussiveRatio > 60 ? "Punchy transient drums" : "",
    sidecar.spectral_rolloff_hz > 4500 ? "Airy high-end sheen" : "",
  ].filter(Boolean);

  const next = {
    ...report,
    ...suggestions,
    suggestedGenres,
    suggestedRhythms: uniq([...(sidecarRhythms || []), ...(suggestions.suggestedRhythms || [])]),
    suggestedSounds: uniq([...(sidecarSounds || []), ...(suggestions.suggestedSounds || [])]),
    duration: sidecar.duration_sec || report.duration,
    bpm,
    estimatedBpm,
    estimatedKey,
    spectralCentroidHz,
    sidecarFeatures: {
      keyConfidence,
      spectralBandwidthHz: Math.round(sidecar.spectral_bandwidth_hz || 0),
      spectralRolloffHz: Math.round(sidecar.spectral_rolloff_hz || 0),
      onsetStrength: Number(sidecar.onset_strength || 0),
      beatCount: Number(sidecar.beat_count || 0),
      beatDensity,
      percussiveRatio,
      harmonicRatio,
    },
    analysisEngine: mlGenres?.topGenre ? "sidecar+hf-genre" : "sidecar",
    sidecarDevice: sidecar.device,
    genreModel: sidecar.genre_model || (mlGenres?.topGenre ? HF_GENRE_MODEL_ID : undefined),
    hfGenrePredictions: sidecar.genre_predictions,
    hfGenreLabels: mlGenres?.hfGenreLabels,
    trackSummary,
  };

  next.summary = buildAudioAnalysisSummary(next);
  return next;
}
