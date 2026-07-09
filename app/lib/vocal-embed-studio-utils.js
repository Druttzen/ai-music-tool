/**
 * Pure helpers for Vocal Embed Studio capabilities and engine labels.
 */

/**
 * @param {object} params
 * @param {object|null|undefined} params.plan
 * @param {object|null|undefined} params.sidecarHealth
 * @param {object|null|undefined} params.vocalModels
 * @param {object|null|undefined} params.alignPreview
 * @param {boolean} [params.guideVocalAttached]
 * @param {File|null|undefined} [params.guideVocalFile]
 */
export function computeVocalEmbedCapabilities({
  plan,
  sidecarHealth,
  vocalModels,
  alignPreview,
  guideVocalAttached = false,
  guideVocalFile = null,
}) {
  const canLyricsOnlySynth =
    plan?.sidecarMode === "lyrics-to-vocal-synthesis" &&
    (!!sidecarHealth?.vocal_ml_available || !!vocalModels?.diffsinger_configured);
  const hasStoredAlign = !!alignPreview?.sections?.some((section) => section?.alignedWords?.length);
  const canSynthesize =
    plan?.stage === "ready" && (!!guideVocalFile || canLyricsOnlySynth || hasStoredAlign);
  const openvpiInferenceReady =
    !!vocalModels?.diffsinger_openvpi?.ready &&
    plan?.stage === "ready" &&
    plan?.sidecarMode === "lyrics-to-vocal-synthesis";

  return {
    canLyricsOnlySynth,
    hasStoredAlign,
    canSynthesize,
    openvpiInferenceReady,
    guideVocalAttached,
    guideVocalFile,
  };
}

/**
 * @param {object} params
 * @param {string|null|undefined} [params.responseEngine]
 * @param {File|null|undefined} [params.guideVocalFile]
 * @param {object|null|undefined} [params.plan]
 * @param {object|null|undefined} [params.sidecarHealth]
 * @param {object|null|undefined} [params.vocalModels]
 */
export function resolveVocalEmbedEngineLabel({
  responseEngine,
  guideVocalFile,
  plan,
  sidecarHealth,
  vocalModels,
}) {
  if (responseEngine) return responseEngine;
  if (guideVocalFile && plan?.sidecarMode === "guide-vocal-conversion") {
    if (vocalModels?.rvc_ready) return "rvc-conversion-v1";
    if (sidecarHealth?.vocal_ml_available) return "guide-conversion-v1";
    return "placement-mix-v1";
  }
  if (vocalModels?.diffsinger_openvpi?.ready) return "openvpi-diffsinger-v1";
  if (vocalModels?.diffsinger_configured) return "diffsinger-v1";
  return "lyrics-synth-v1";
}

/**
 * @param {object} params
 * @param {object|null|undefined} [params.plan]
 * @param {boolean} [params.canLyricsOnlySynth]
 * @param {boolean} [params.hasStoredAlign]
 * @param {File|null|undefined} [params.guideVocalFile]
 * @param {boolean} [params.sidecarBusy]
 */
export function vocalEmbedSynthesizeButtonLabel({
  plan,
  canLyricsOnlySynth,
  hasStoredAlign,
  guideVocalFile,
  sidecarBusy,
}) {
  if (sidecarBusy) return "Synthesizing…";
  if (hasStoredAlign && !guideVocalFile) return "Synthesize with saved alignment";
  if (plan?.sidecarMode === "lyrics-to-vocal-synthesis" && guideVocalFile) {
    return "Synthesize lyrics + guide timing";
  }
  if (canLyricsOnlySynth && !guideVocalFile) return "Synthesize lyrics-only preview";
  return "Synthesize placement-mix preview";
}
