/**
 * Local vocal-trait analysis from uploaded audio (browser DSP heuristics).
 * Output is descriptive Suno prompt DNA — not voice cloning or identity matching.
 */

import { clamp } from "./music-helpers";

const REGISTER_BANDS = [
  { id: "bass", label: "bass register", min: 80, max: 155 },
  { id: "baritone", label: "baritone register", min: 155, max: 200 },
  { id: "tenor", label: "tenor register", min: 200, max: 260 },
  { id: "alto", label: "alto register", min: 260, max: 320 },
  { id: "mezzo", label: "mezzo register", min: 320, max: 390 },
  { id: "soprano", label: "soprano register", min: 390, max: 520 },
];

/**
 * @param {Float32Array} slice
 * @param {number} sampleRate
 * @param {number} [minHz]
 * @param {number} [maxHz]
 */
export function estimateF0Hz(slice, sampleRate, minHz = 75, maxHz = 500) {
  const n = slice.length;
  if (n < sampleRate * 0.04) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / minHz));
  if (minLag >= maxLag) return null;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += slice[i];
  mean /= n;

  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let i = 0; i < n - lag; i++) {
      score += (slice[i] - mean) * (slice[i + lag] - mean);
    }
    score /= n - lag;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore <= 0) return null;
  return sampleRate / bestLag;
}

/**
 * @param {number} hz
 */
export function registerFromPitchHz(hz) {
  if (!hz || Number.isNaN(hz)) return { id: "unknown", label: "mixed register" };
  const hit =
    REGISTER_BANDS.find((b) => hz >= b.min && hz < b.max) ||
    REGISTER_BANDS[REGISTER_BANDS.length - 1];
  return { id: hit.id, label: hit.label };
}

/**
 * @param {Float32Array} slice
 * @param {number} sampleRate
 */
function analyzeFrameTraits(slice, sampleRate) {
  let sum = 0;
  let peak = 0;
  let zc = 0;
  let prev = slice[0];
  for (let i = 0; i < slice.length; i++) {
    const v = slice[i];
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
    if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) zc++;
    prev = v;
  }
  const rms = Math.sqrt(sum / slice.length);
  const zcr = zc / slice.length;
  const f0 = estimateF0Hz(slice, sampleRate);
  return { rms, peak, zcr, f0 };
}

/**
 * @param {AudioBuffer} buffer
 * @param {string} fileName
 * @param {object} [sourceMeta]
 */
export function analyzeVoiceCharacter(buffer, fileName, sourceMeta = {}) {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const frameSize = Math.floor(sampleRate * 0.04);
  const hop = Math.floor(frameSize / 2);
  const f0Samples = [];
  const rmsSamples = [];
  const zcrSamples = [];

  for (let start = 0; start + frameSize < channel.length; start += hop) {
    const slice = channel.subarray(start, start + frameSize);
    const { rms, zcr, f0 } = analyzeFrameTraits(slice, sampleRate);
    if (rms < 0.008) continue;
    rmsSamples.push(rms);
    zcrSamples.push(zcr);
    if (f0 && f0 >= 75 && f0 <= 520) f0Samples.push(f0);
  }

  const pitchMedianHz =
    f0Samples.length > 0
      ? f0Samples.slice().sort((a, b) => a - b)[Math.floor(f0Samples.length / 2)]
      : null;
  const pitchMinHz = f0Samples.length ? Math.min(...f0Samples) : null;
  const pitchMaxHz = f0Samples.length ? Math.max(...f0Samples) : null;

  const register = registerFromPitchHz(pitchMedianHz);

  let vibratoStrength = 0;
  if (f0Samples.length > 8) {
    const mean = f0Samples.reduce((a, b) => a + b, 0) / f0Samples.length;
    const variance =
      f0Samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / f0Samples.length;
    const cv = Math.sqrt(variance) / Math.max(mean, 1);
    vibratoStrength = clamp(Math.round(cv * 900), 0, 100);
  }

  const avgRms = rmsSamples.length
    ? rmsSamples.reduce((a, b) => a + b, 0) / rmsSamples.length
    : 0;
  const rmsSpread =
    rmsSamples.length > 1
      ? Math.max(...rmsSamples) / Math.max(Math.min(...rmsSamples), 1e-6)
      : 1;
  const dynamics = clamp(Math.round((rmsSpread - 1) * 35 + avgRms * 120), 0, 100);

  const avgZcr = zcrSamples.length
    ? zcrSamples.reduce((a, b) => a + b, 0) / zcrSamples.length
    : 0;
  const breathiness = clamp(Math.round(avgZcr * 520 + (1 - avgRms * 8) * 20), 0, 100);
  const brightness = clamp(Math.round(avgZcr * 380 + (pitchMedianHz ? pitchMedianHz / 8 : 40)), 0, 100);

  const onsetsPerSec = rmsSamples.length / Math.max(duration, 0.5);
  const deliveryPace =
    onsetsPerSec > 18 ? "rapid phrasing" : onsetsPerSec < 9 ? "laid-back phrasing" : "moderate phrasing";

  /** @type {string[]} */
  const textureTags = [];
  if (breathiness > 58) textureTags.push("breathy");
  if (breathiness < 28 && brightness > 45) textureTags.push("clear chest tone");
  if (vibratoStrength > 45) textureTags.push("expressive vibrato");
  if (vibratoStrength < 18) textureTags.push("steady pitch");
  if (dynamics > 62) textureTags.push("dynamic belting");
  if (dynamics < 35) textureTags.push("intimate close-mic");
  if (brightness > 62) textureTags.push("bright forward presence");
  if (brightness < 38) textureTags.push("warm dark timbre");
  if (avgRms < 0.025) textureTags.push("whisper-soft delivery");
  if (!textureTags.length) textureTags.push("neutral studio vocal");

  const suggestedVocalRole = suggestVocalRoleFromTraits(register.id, dynamics, brightness);
  const characterLabel = buildCharacterLabel(register.label, textureTags, deliveryPace);

  const vocalsLikely = f0Samples.length > Math.max(6, (duration * 2) | 0);
  const confidence = clamp(
    Math.round((f0Samples.length / Math.max(1, rmsSamples.length)) * 100 + (vocalsLikely ? 25 : 0)),
    0,
    100,
  );

  return {
    version: 1,
    fileName: fileName || "vocal-sample",
    duration,
    source: sourceMeta,
    pitchMedianHz: pitchMedianHz ? Math.round(pitchMedianHz) : null,
    pitchMinHz: pitchMinHz ? Math.round(pitchMinHz) : null,
    pitchMaxHz: pitchMaxHz ? Math.round(pitchMaxHz) : null,
    register: register.id,
    registerLabel: register.label,
    vibratoStrength,
    breathiness,
    brightness,
    dynamics,
    deliveryPace,
    textureTags,
    suggestedVocalRole,
    characterLabel,
    confidence,
    vocalsLikely,
    summary: buildAnalysisSummary({
      characterLabel,
      pitchMedianHz,
      deliveryPace,
      textureTags,
      confidence,
      vocalsLikely,
    }),
  };
}

/**
 * @param {string} registerId
 * @param {number} dynamics
 * @param {number} brightness
 */
export function suggestVocalRoleFromTraits(registerId, dynamics, brightness) {
  const low = registerId === "bass" || registerId === "baritone";
  const high = registerId === "alto" || registerId === "mezzo" || registerId === "soprano";
  if (dynamics > 70) return low ? "Male Lead" : high ? "Female Lead" : "Rave Chant";
  if (brightness > 65 && high) return "Female Lead";
  if (low) return "Male Lead";
  if (high) return "Female Lead";
  return "Male Lead";
}

/**
 * @param {string} registerLabel
 * @param {string[]} textureTags
 * @param {string} deliveryPace
 */
export function buildCharacterLabel(registerLabel, textureTags, deliveryPace) {
  const tags = textureTags.slice(0, 3).join(", ");
  return `${registerLabel}, ${tags}, ${deliveryPace}`.replace(/\s+/g, " ").trim();
}

/**
 * @param {object} parts
 */
export function buildAnalysisSummary(parts) {
  const pitch = parts.pitchMedianHz ? `${Math.round(parts.pitchMedianHz)} Hz median pitch` : "pitch unclear";
  const tags = parts.textureTags?.slice(0, 4).join(", ") || "neutral vocal";
  const conf = parts.confidence ?? 0;
  const vocalHint = parts.vocalsLikely ? "Lead vocal detected" : "Weak vocal signal — try an isolated vocal or acapella";
  return `${parts.characterLabel}. ${pitch}; ${parts.deliveryPace}. Traits: ${tags}. ${vocalHint} (${conf}% confidence).`;
}

/**
 * @param {File} file
 * @param {object} [sourceMeta]
 */
export async function decodeAndAnalyzeVoiceFile(file, sourceMeta = {}) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return analyzeVoiceCharacter(buffer, file.name, {
      type: "file",
      fileName: file.name,
      ...sourceMeta,
    });
  } finally {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
  }
}
