/** In-app copy: local analyzers are heuristic, not ML classification. */

export const AUDIO_ANALYZER_DISCLAIMER =
  "Reference hints only — BPM, key, and genre tags come from a fast local scan (energy, rhythm envelope, brightness). They are not Sonoteller-style ML. Edit tags before merging into Suno.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR =
  "Tempo and key from local librosa analysis (Python sidecar). Genre/mood tags still use heuristic mapping — edit before merge.";

export const AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF =
  "Tempo/key from librosa; genre tags from Hugging Face wav2vec2 (GTzan). Still reference-only — edit before merge.";

/** @param {{ analysisEngine?: string }|null|undefined} analysis */
export function getAudioAnalyzerDisclaimer(analysis) {
  if (analysis?.analysisEngine === "sidecar+hf-genre") {
    return AUDIO_ANALYZER_DISCLAIMER_SIDECAR_HF;
  }
  return analysis?.analysisEngine === "sidecar"
    ? AUDIO_ANALYZER_DISCLAIMER_SIDECAR
    : AUDIO_ANALYZER_DISCLAIMER;
}

export const IMAGE_ANALYZER_DISCLAIMER =
  "Palette-driven suggestions from brightness, contrast, and color — artistic interpretation, not scene recognition. Edit before merge.";

export const IMAGE_ANALYZER_DISCLAIMER_SIDECAR =
  "Palette metrics plus BLIP scene caption from the local vision sidecar. Still reference-only — edit before merge.";

/** @param {{ analysisEngine?: string }|null|undefined} analysis */
export function getImageAnalyzerDisclaimer(analysis) {
  return analysis?.analysisEngine === "pixel+blip"
    ? IMAGE_ANALYZER_DISCLAIMER_SIDECAR
    : IMAGE_ANALYZER_DISCLAIMER;
}
