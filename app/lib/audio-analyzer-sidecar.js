/**
 * Merge librosa sidecar results into the heuristic browser report shape.
 * Keeps waveform, highlight, and catalog suggestions; overrides tempo/key/centroid.
 */

import { buildAudioAnalyzerSuggestions } from "./analyzer-suggestions";
import { buildAudioAnalysisSummary, formatTime } from "./audio-analyzer";
import { HF_GENRE_MODEL_ID, mapHfGenrePredictionsToSuno } from "./hf-genre-map";
import { clamp } from "./music-helpers";

/**
 * @param {object} report Heuristic report from {@link analyzeAudioBuffer}.
 * @param {{ duration_sec: number, tempo_bpm: number, key_estimate: string, spectral_centroid_hz: number, device: string, genre_predictions?: { label: string, score: number }[], genre_model?: string }} sidecar
 */
export function mergeSidecarAnalysis(report, sidecar) {
  const bpm = Math.round(clamp(sidecar.tempo_bpm, 60, 200));
  const estimatedBpm = `${bpm} BPM`;
  const estimatedKey = String(sidecar.key_estimate || report.estimatedKey);
  const spectralCentroidHz = Math.round(sidecar.spectral_centroid_hz);

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
    ? `${interpretation} Librosa: ${estimatedBpm} in ${estimatedKey}; HF genre ${mlGenres.topGenre}${topGenrePct != null ? ` (${topGenrePct}%)` : ""}. Peak section around ${formatTime(report.highlightStart)}. Edit tags before merging into Suno.`
    : `${interpretation} Librosa analysis estimates ${estimatedBpm} in ${estimatedKey}; peak section around ${formatTime(report.highlightStart)}. Edit tags below before merging into Suno.`;

  const suggestedGenres =
    mlGenres?.suggestedGenres?.length > 0
      ? mlGenres.suggestedGenres
      : suggestions.suggestedGenres;

  const next = {
    ...report,
    ...suggestions,
    suggestedGenres,
    duration: sidecar.duration_sec || report.duration,
    bpm,
    estimatedBpm,
    estimatedKey,
    spectralCentroidHz,
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
