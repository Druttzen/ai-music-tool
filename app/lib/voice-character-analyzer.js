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
  let diffSum = 0;
  let peak = 0;
  let zc = 0;
  let prev = slice[0];
  for (let i = 0; i < slice.length; i++) {
    const v = slice[i];
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
    if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) zc++;
    if (i > 0) diffSum += Math.abs(v - prev);
    prev = v;
  }
  const rms = Math.sqrt(sum / slice.length);
  const zcr = zc / slice.length;
  const roughness = diffSum / Math.max(1, slice.length - 1);
  const crest = peak / Math.max(rms, 1e-6);
  const f0 = estimateF0Hz(slice, sampleRate);
  return { rms, peak, zcr, roughness, crest, f0 };
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values, avg = mean(values)) {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length);
}

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = clamp(Math.round((pct / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

function semitoneRange(minHz, maxHz) {
  if (!minHz || !maxHz || minHz <= 0 || maxHz <= minHz) return 0;
  return Math.round(12 * Math.log2(maxHz / minHz));
}

function describeRange(semitones) {
  if (semitones >= 14) return "wide melodic range";
  if (semitones >= 8) return "moderate melodic range";
  if (semitones >= 3) return "narrow controlled range";
  return "near-monotone focus";
}

function describeVibrato(strength, rateHz) {
  if (strength > 55 && rateHz >= 4 && rateHz <= 8) return `clear ${rateHz.toFixed(1)} Hz vibrato`;
  if (strength > 35) return "gentle vibrato";
  if (strength < 18) return "straight-tone pitch";
  return "subtle pitch movement";
}

function describeArticulation(onsetsPerSec, avgCrest) {
  if (onsetsPerSec > 18 || avgCrest > 5.5) return "crisp fast articulation";
  if (onsetsPerSec < 9 && avgCrest < 4.2) return "smooth legato articulation";
  return "balanced syllable articulation";
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
  const roughnessSamples = [];
  const crestSamples = [];

  for (let start = 0; start + frameSize < channel.length; start += hop) {
    const slice = channel.subarray(start, start + frameSize);
    const { rms, zcr, roughness, crest, f0 } = analyzeFrameTraits(slice, sampleRate);
    if (rms < 0.008) continue;
    rmsSamples.push(rms);
    zcrSamples.push(zcr);
    roughnessSamples.push(roughness);
    crestSamples.push(crest);
    if (f0 && f0 >= 75 && f0 <= 520) f0Samples.push(f0);
  }

  const pitchMedianHz = median(f0Samples);
  const pitchMinHz = percentile(f0Samples, 5);
  const pitchMaxHz = percentile(f0Samples, 95);
  const pitchRangeSemitones = semitoneRange(pitchMinHz, pitchMaxHz);

  const register = registerFromPitchHz(pitchMedianHz);

  let vibratoStrength = 0;
  let vibratoRateHz = 0;
  let pitchStability = 0;
  let jitter = 0;
  if (f0Samples.length > 8) {
    const f0Mean = mean(f0Samples);
    const f0Std = stddev(f0Samples, f0Mean);
    const cv = f0Std / Math.max(f0Mean, 1);
    vibratoStrength = clamp(Math.round(cv * 900), 0, 100);
    pitchStability = clamp(Math.round(100 - cv * 650), 0, 100);
    const diffs = [];
    let crossings = 0;
    let prevCentered = f0Samples[0] - f0Mean;
    for (let i = 1; i < f0Samples.length; i++) {
      const centered = f0Samples[i] - f0Mean;
      if ((prevCentered < 0 && centered >= 0) || (prevCentered >= 0 && centered < 0)) crossings++;
      prevCentered = centered;
      diffs.push(Math.abs(f0Samples[i] - f0Samples[i - 1]) / Math.max(f0Samples[i - 1], 1));
    }
    jitter = clamp(Math.round(mean(diffs) * 1000), 0, 100);
    const voicedDuration = Math.max((f0Samples.length * hop) / sampleRate, 0.1);
    vibratoRateHz = clamp(crossings / 2 / voicedDuration, 0, 12);
  }

  const avgRms = mean(rmsSamples);
  const rmsSpread =
    rmsSamples.length > 1
      ? Math.max(...rmsSamples) / Math.max(Math.min(...rmsSamples), 1e-6)
      : 1;
  const dynamics = clamp(Math.round((rmsSpread - 1) * 35 + avgRms * 120), 0, 100);
  const shimmer = clamp(Math.round((stddev(rmsSamples, avgRms) / Math.max(avgRms, 1e-6)) * 120), 0, 100);

  const avgZcr = mean(zcrSamples);
  const avgRoughness = mean(roughnessSamples);
  const avgCrest = mean(crestSamples);
  const breathiness = clamp(Math.round(avgZcr * 520 + (1 - avgRms * 8) * 20), 0, 100);
  const brightness = clamp(Math.round(avgZcr * 380 + (pitchMedianHz ? pitchMedianHz / 8 : 40)), 0, 100);
  const roughness = clamp(Math.round(avgRoughness * 2600 + jitter * 0.35), 0, 100);
  const sibilance = clamp(Math.round(avgZcr * 720 + avgCrest * 4), 0, 100);

  const onsetsPerSec = rmsSamples.length / Math.max(duration, 0.5);
  const deliveryPace =
    onsetsPerSec > 18 ? "rapid phrasing" : onsetsPerSec < 9 ? "laid-back phrasing" : "moderate phrasing";
  const rangeLabel = describeRange(pitchRangeSemitones);
  const vibratoLabel = describeVibrato(vibratoStrength, vibratoRateHz);
  const articulation = describeArticulation(onsetsPerSec, avgCrest);
  const toneFocus =
    brightness > 66
      ? "forward bright resonance"
      : brightness < 38
        ? "warm chest resonance"
        : "balanced studio resonance";

  /** @type {string[]} */
  const textureTags = [];
  if (breathiness > 58) textureTags.push("breathy");
  if (breathiness < 28 && brightness > 45) textureTags.push("clear chest tone");
  if (vibratoStrength > 45) textureTags.push("expressive vibrato");
  if (vibratoStrength < 18) textureTags.push("steady pitch");
  if (roughness > 58) textureTags.push("raspy edge");
  if (sibilance > 68) textureTags.push("airy sibilants");
  if (pitchRangeSemitones >= 12) textureTags.push("wide pitch arcs");
  if (pitchStability > 76) textureTags.push("locked pitch center");
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
    pitchRangeSemitones,
    pitchStability,
    register: register.id,
    registerLabel: register.label,
    vibratoStrength,
    vibratoRateHz: Number(vibratoRateHz.toFixed(1)),
    jitter,
    shimmer,
    breathiness,
    brightness,
    roughness,
    sibilance,
    dynamics,
    deliveryPace,
    articulation,
    rangeLabel,
    vibratoLabel,
    toneFocus,
    onsetsPerSec: Number(onsetsPerSec.toFixed(1)),
    textureTags,
    suggestedVocalRole,
    characterLabel,
    confidence,
    vocalsLikely,
    summary: buildAnalysisSummary({
      characterLabel,
      pitchMedianHz,
      pitchRangeSemitones,
      deliveryPace,
      articulation,
      vibratoLabel,
      toneFocus,
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
  const range = Number(parts.pitchRangeSemitones) > 0 ? `${parts.pitchRangeSemitones} semitone range` : "range unclear";
  const conf = parts.confidence ?? 0;
  const vocalHint = parts.vocalsLikely ? "Lead vocal detected" : "Weak vocal signal — try an isolated vocal or acapella";
  return `${parts.characterLabel}. ${pitch}; ${range}; ${parts.vibratoLabel || "vibrato unclear"}; ${parts.articulation || parts.deliveryPace}; ${parts.toneFocus || "balanced tone"}. Traits: ${tags}. ${vocalHint} (${conf}% confidence).`;
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
