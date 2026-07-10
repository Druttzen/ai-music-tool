/** In-app copy: local analyzers are heuristic, not ML classification. */

export const AUDIO_ANALYZER_DISCLAIMER =
  "Reference hints only — BPM, key, and genre tags come from a fast local scan (energy, rhythm envelope, brightness). They are not Sonoteller-style ML. Edit tags before merging into Suno.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR =
  "Tempo and key from local librosa analysis (Python sidecar). Genre/mood tags still use heuristic mapping — edit before merge.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR_SONIC =
  "Tempo, key, and chord hints from local librosa analysis (Python sidecar) plus sonic signature. Genre/mood tags still use heuristic mapping — edit before merge.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF =
  "Tempo/key from librosa; genre tags from Hugging Face wav2vec2 (GTzan). Still reference-only — edit before merge.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF_SONIC =
  "Tempo, key, and chords from librosa + sonic signature; genre tags from Hugging Face wav2vec2 (GTzan). Still reference-only — edit before merge.";

/** @param {{ analysisEngine?: string }|null|undefined} analysis */
export function getAudioAnalyzerDisclaimer(analysis) {
  const engine = String(analysis?.analysisEngine || "");
  if (engine.includes("hf-genre")) {
    return engine.includes("sonic")
      ? AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF_SONIC
      : AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF;
  }
  if (engine.includes("sidecar") || engine === "sonic") {
    return engine.includes("sonic")
      ? AUDIO_ANALYZER_DISCLAIMER_SIDECAR_SONIC
      : AUDIO_ANALYZER_DISCLAIMER_SIDECAR;
  }
  return AUDIO_ANALYZER_DISCLAIMER;
}

/**
 * Short source line under the track name in Drag & Drop Analyzers.
 * @param {{ analysisEngine?: string }|null|undefined} analysis
 */
export function formatAudioAnalysisSourceLabel(analysis) {
  const engine = String(analysis?.analysisEngine || "");
  if (!engine || engine === "heuristic") {
    return "Local browser scan (edit before merge)";
  }
  const parts = [];
  if (engine.includes("sidecar") || engine === "sidecar-fallback") parts.push("librosa sidecar");
  if (engine.includes("hf-genre")) parts.push("HF genre");
  if (engine.includes("sonic")) parts.push("sonic signature");
  if (engine.includes("musicgen")) parts.push("MusicGen");
  if (parts.length === 0) return "Analyzed (edit before merge)";
  return `${parts.join(" + ")} (edit before merge)`;
}

/**
 * @param {{ analysisEngine?: string }|null|undefined} analysis
 * @returns {string[]}
 */
export function listAudioAnalysisEngineBadges(analysis) {
  const engine = String(analysis?.analysisEngine || "");
  if (!engine || engine === "heuristic") return ["browser scan"];
  const badges = [];
  if (engine.includes("sidecar")) badges.push("librosa");
  if (engine.includes("hf-genre")) badges.push("HF genre");
  if (engine.includes("sonic")) badges.push("sonic");
  if (engine.includes("musicgen")) badges.push("MusicGen");
  if (engine === "sidecar-fallback") badges.push("sidecar decode");
  return badges.length ? badges : [engine];
}

export const IMAGE_ANALYZER_DISCLAIMER =
  "Palette-driven suggestions from brightness, contrast, and color — artistic interpretation, not scene recognition. Edit before merge.";

export const IMAGE_ANALYZER_DISCLAIMER_SIDECAR =
  "Palette metrics plus BLIP scene caption from the local vision sidecar. Still reference-only — edit before merge.";

/** @param {{ analysisEngine?: string }|null|undefined} analysis */
export function getImageAnalyzerDisclaimer(analysis) {
  const engine = String(analysis?.analysisEngine || "");
  return engine.includes("blip") ? IMAGE_ANALYZER_DISCLAIMER_SIDECAR : IMAGE_ANALYZER_DISCLAIMER;
}
