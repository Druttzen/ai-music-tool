/**
 * Local (browser) audio analysis — heuristic DSP + editable report shape for the track editor UI.
 */

import { makeAudioLookupKey } from "./audio-cache";
import { clamp, uniq } from "./music-helpers";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * @param {Float32Array} channel
 * @param {number} sampleRate
 * @returns {{ envelope: Float32Array, frameCount: number, hop: number }}
 */
function buildOnsetEnvelope(channel, sampleRate) {
  const targetRate = 200;
  const hop = Math.max(1, Math.floor(sampleRate / targetRate));
  const frameCount = Math.floor(channel.length / hop);
  const envelope = new Float32Array(frameCount);
  let prev = 0;
  for (let f = 0; f < frameCount; f++) {
    let sum = 0;
    const start = f * hop;
    const end = Math.min(channel.length, start + hop);
    for (let i = start; i < end; i++) sum += channel[i] * channel[i];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    const flux = Math.max(0, rms - prev);
    envelope[f] = flux;
    prev = rms;
  }
  return { envelope, frameCount, hop };
}

/**
 * Autocorrelation peak in BPM range (rough beat tracking).
 * @param {Float32Array} envelope
 * @param {number} frameRate — envelope frames per second
 */
function estimateBpmFromEnvelope(envelope, frameRate) {
  const minBpm = 70;
  const maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * frameRate);
  const maxLag = Math.ceil((60 / minBpm) * frameRate);
  const n = envelope.length;
  if (n < maxLag * 2) return null;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += envelope[i];
  mean /= n;

  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    let count = 0;
    for (let i = 0; i < n - lag; i++) {
      score += (envelope[i] - mean) * (envelope[i + lag] - mean);
      count++;
    }
    if (count > 0) score /= count;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore <= 0) return null;
  return Math.round(clamp((60 * frameRate) / bestLag, minBpm, maxBpm));
}

/**
 * Fast brightness / treble proxy (not a true FFT centroid).
 * @param {Float32Array} channel
 * @param {number} sampleRate
 */
function estimateSpectralCentroidHz(channel, sampleRate) {
  const limit = Math.min(channel.length, Math.floor(sampleRate * 90));
  const step = Math.max(1, Math.floor(sampleRate / 400));
  let hf = 0;
  let total = 0;
  let prev = channel[0];
  let frames = 0;
  for (let i = step; i < limit; i += step) {
    const v = channel[i];
    hf += Math.abs(v - prev);
    total += Math.abs(v);
    prev = v;
    frames++;
  }
  if (frames < 1 || total < 1e-9) return 440;
  const ratio = hf / total;
  const level = total / frames;
  return clamp(200 + ratio * 3800 + level * 1200, 120, 4500);
}

/**
 * Very rough key hint from spectral centroid (not true key detection).
 * @param {number} centroidHz
 */
function guessKeyFromCentroid(centroidHz) {
  if (!centroidHz || centroidHz < 80) return "Key unclear";
  const midi = 12 * Math.log2(centroidHz / 440) + 69;
  const note = NOTE_NAMES[clamp(Math.round(midi) % 12, 0, 11)];
  return centroidHz > 2200 ? `${note} minor` : `${note} major`;
}

/**
 * @param {Float32Array} channel
 * @param {number} sampleRate
 * @param {number} duration
 */
function findHighlightWindow(channel, sampleRate, duration) {
  const windowSec = Math.min(30, Math.max(8, duration * 0.15));
  const windowSamples = Math.floor(windowSec * sampleRate);
  if (windowSamples < sampleRate || duration < windowSec) {
    return {
      highlightLabel: "Full track",
      highlightStart: 0,
      highlightEnd: duration,
    };
  }
  const hop = Math.floor(sampleRate * 2);
  let bestStart = 0;
  let bestEnergy = -1;
  for (let start = 0; start + windowSamples < channel.length; start += hop) {
    let sum = 0;
    for (let i = start; i < start + windowSamples; i++) sum += channel[i] * channel[i];
    const e = sum / windowSamples;
    if (e > bestEnergy) {
      bestEnergy = e;
      bestStart = start;
    }
  }
  const highlightStart = bestStart / sampleRate;
  const highlightEnd = Math.min(duration, highlightStart + windowSec);
  const mid = highlightStart + windowSec / 2;
  const label =
    mid > duration * 0.55
      ? "Late peak (possible chorus/outro)"
      : mid < duration * 0.35
        ? "Early peak (intro/hook)"
        : "Peak energy section";
  return { highlightLabel: label, highlightStart, highlightEnd };
}

function formatBpmLabel(bpm) {
  if (!bpm || Number.isNaN(bpm)) return "120 BPM";
  return `${Math.round(clamp(bpm, 60, 200))} BPM`;
}

function buildSuggestions(metrics) {
  const { energy, aggression, brightness, darkness, complexity, bpm, centroidHz } = metrics;
  const suggestedGenres = [];
  const suggestedSubgenres = [];
  const suggestedMoods = [];
  const suggestedInstruments = [];
  const suggestedSounds = [];
  const suggestedRhythms = [];

  if (energy > 65 && aggression > 55) {
    suggestedGenres.push("Techno", "Electronic");
    suggestedSubgenres.push("Peak-time", "Club");
    suggestedMoods.push("Driving", "Intense");
    suggestedInstruments.push("Synth bass", "Drum machine", "Hi-hats");
    suggestedSounds.push("Heavy sub bass", "Big drums");
    suggestedRhythms.push("4/4", "Syncopated");
  } else if (energy < 40 && darkness > 55) {
    suggestedGenres.push("Ambient", "Cinematic");
    suggestedSubgenres.push("Atmospheric", "Drone");
    suggestedMoods.push("Calm", "Mysterious");
    suggestedInstruments.push("Pads", "Strings", "Soft piano");
    suggestedSounds.push("Dark pads", "Noise atmosphere");
    suggestedRhythms.push("Minimal", "Free time");
  } else {
    suggestedGenres.push("Electronic", "Pop");
    suggestedSubgenres.push("Modern", "Hybrid");
    suggestedMoods.push("Balanced", "Focused");
    suggestedInstruments.push("Synths", "Drums", "Bass");
    suggestedSounds.push("Analog synths", "Balanced mix");
    suggestedRhythms.push("4/4");
  }

  if (brightness > 58) {
    suggestedMoods.push("Bright");
    suggestedInstruments.push("Bright leads");
    suggestedSounds.push("Bright leads", "Glitch FX");
  }
  if (aggression > 65) {
    suggestedSounds.push("Distorted bass", "Metallic percussion");
    suggestedMoods.push("Aggressive");
  }
  if (complexity > 60) suggestedRhythms.push("Breakbeat", "Off-grid");
  if (bpm && bpm > 128) suggestedSubgenres.push("Uptempo");
  if (bpm && bpm < 95) suggestedSubgenres.push("Downtempo");

  const vocals =
    centroidHz > 2800 && energy > 45
      ? "Vocals likely"
      : energy < 30 && aggression < 40
        ? "Instrumental likely"
        : "Mixed / uncertain";

  return {
    suggestedGenres: uniq(suggestedGenres),
    suggestedSubgenres: uniq(suggestedSubgenres),
    suggestedMoods: uniq(suggestedMoods),
    suggestedInstruments: uniq(suggestedInstruments),
    suggestedSounds: uniq(suggestedSounds),
    suggestedRhythms: uniq(suggestedRhythms),
    vocals,
  };
}

/**
 * @param {object} report
 */
export function buildAudioAnalysisSummary(report) {
  if (!report) return "";
  const lines = [
    `File: ${report.fileName || "audio"}`,
    `Duration: ${Number(report.duration || 0).toFixed(1)}s`,
    report.trackSummary ? `Summary: ${report.trackSummary}` : "",
    `Energy ${report.energy}/100 · Aggression ${report.aggression}/100 · Brightness ${report.brightness}/100`,
    `Tempo: ${report.estimatedBpm || "—"} · Key (estimate): ${report.estimatedKey || "—"}`,
    `Highlight: ${report.highlightLabel || "—"} (${formatTime(report.highlightStart)}–${formatTime(report.highlightEnd)})`,
    `Genres: ${(report.suggestedGenres || []).join(", ") || "—"}`,
    `Subgenres: ${(report.suggestedSubgenres || []).join(", ") || "—"}`,
    `Moods: ${(report.suggestedMoods || []).join(", ") || "—"}`,
    `Instruments: ${(report.suggestedInstruments || []).join(", ") || "—"}`,
    `Rhythm: ${(report.suggestedRhythms || []).join(", ") || "—"}`,
    `Sounds: ${(report.suggestedSounds || []).join(", ") || "—"}`,
    `Vocals: ${report.vocals || "—"}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function formatTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * @param {number} duration
 * @param {number} start
 * @param {number} end
 * @param {number} [minSpanSec]
 */
export function normalizeHighlightRange(duration, start, end, minSpanSec = 2) {
  const dur = Math.max(0.001, Number(duration) || 0);
  const minSpan = Math.min(minSpanSec, dur * 0.5);
  let s = clamp(Number(start) || 0, 0, dur);
  let e = clamp(Number(end) || dur, 0, dur);
  if (e < s) [s, e] = [e, s];
  if (e - s < minSpan) {
    e = Math.min(dur, s + minSpan);
    s = Math.max(0, e - minSpan);
  }
  return { highlightStart: s, highlightEnd: e };
}

/** Default bar count for editor waveforms (kept small for localStorage). */
export const WAVEFORM_BAR_COUNT = 240;

/**
 * Peak envelope for waveform UI (values 0–1).
 * @param {Float32Array} channel
 * @param {number} [barCount]
 * @returns {number[]}
 */
export function buildWaveformPeaks(channel, barCount = WAVEFORM_BAR_COUNT) {
  const count = Math.max(32, Math.min(400, Math.floor(barCount)));
  if (!channel?.length) return Array(count).fill(0);
  const block = Math.ceil(channel.length / count);
  const peaks = new Array(count);
  let max = 0;
  for (let b = 0; b < count; b++) {
    let peak = 0;
    const start = b * block;
    const end = Math.min(channel.length, start + block);
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(channel[i]));
    peaks[b] = peak;
    if (peak > max) max = peak;
  }
  const norm = max < 1e-9 ? 1 : max;
  return peaks.map((p) => Math.round((p / norm) * 1000) / 1000);
}

/**
 * @param {number[]} peaks
 * @param {number} duration
 * @param {number} startSec
 * @param {number} endSec
 */
export function sliceWaveformPeaksForRange(peaks, duration, startSec, endSec) {
  if (!peaks?.length || !duration) return [];
  const start = Math.max(0, Math.min(duration, startSec));
  const end = Math.max(start, Math.min(duration, endSec));
  const n = peaks.length;
  const i0 = Math.floor((start / duration) * n);
  const i1 = Math.max(i0 + 1, Math.ceil((end / duration) * n));
  return peaks.slice(i0, i1);
}

/** @param {object|null} analysis */
export function analysisNeedsWaveformPeaks(analysis) {
  return Boolean(analysis && (!analysis.waveformPeaks || analysis.waveformPeaks.length < 32));
}

/**
 * Shape-only fallback when no cached audio (legacy saves). Highlights still align to stored times.
 * @param {object} analysis
 * @returns {number[]}
 */
export function synthesizeWaveformPeaksFromAnalysis(analysis) {
  const bars = WAVEFORM_BAR_COUNT;
  const dur = Math.max(0.001, analysis?.duration || 1);
  const hs = analysis?.highlightStart ?? 0;
  const he = analysis?.highlightEnd ?? dur;
  const base = ((analysis?.energy ?? 50) / 100) * 0.45 + 0.12;
  const peakBoost = ((analysis?.aggression ?? 50) / 100) * 0.5;
  const seed = String(analysis?.fileName || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  return Array.from({ length: bars }, (_, i) => {
    const t = (i / bars) * dur;
    const inHighlight = t >= hs && t <= he;
    const hump = inHighlight ? 0.28 + peakBoost : 0;
    const wobble = 0.1 * Math.sin((i / bars) * Math.PI * 6 + seed * 0.01);
    return clamp(base + hump + wobble, 0.08, 1);
  });
}

/**
 * @param {Blob} blob
 * @returns {Promise<number[]>}
 */
export async function decodeWaveformPeaksFromBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return buildWaveformPeaks(buffer.getChannelData(0));
  } finally {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {AudioBuffer} buffer
 * @param {string} fileName
 */
export function analyzeAudioBuffer(buffer, fileName) {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const step = Math.max(1, Math.floor(channel.length / 80000));
  let sum = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let prev = channel[0];
  for (let i = 0; i < channel.length; i += step) {
    const v = channel[i];
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
    if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) zeroCrossings++;
    prev = v;
  }
  const count = Math.ceil(channel.length / step);
  const rms = Math.sqrt(sum / count);
  const energy = clamp(Math.round(rms * 900));
  const aggression = clamp(Math.round(peak * 100));
  const zcr = zeroCrossings / count;
  const brightness = clamp(Math.round(zcr * 700));
  const darkness = clamp(100 - brightness + Math.round(energy * 0.2));
  const complexity = clamp(Math.round(zcr * 1000 + energy * 0.4));

  const { envelope, hop } = buildOnsetEnvelope(channel, sampleRate);
  const frameRate = sampleRate / hop;
  const bpm = estimateBpmFromEnvelope(envelope, frameRate);
  const fallbackBpm = Math.round(clamp(80 + energy * 0.7 + complexity * 0.25, 70, 180));
  const bpmFinal = bpm || fallbackBpm;
  const estimatedBpm = formatBpmLabel(bpmFinal);

  const centroidHz = estimateSpectralCentroidHz(channel, sampleRate);
  const estimatedKey = guessKeyFromCentroid(centroidHz);
  const loudnessDb = Math.round(20 * Math.log10(Math.max(rms, 1e-6)));

  const highlight = findHighlightWindow(channel, sampleRate, duration);
  const suggestions = buildSuggestions({
    energy,
    aggression,
    brightness,
    darkness,
    complexity,
    bpm: bpmFinal,
    centroidHz,
  });

  const interpretation =
    energy > 70
      ? "High-impact, club-ready reference."
      : energy < 35
        ? "Calm, atmospheric reference."
        : "Controlled, balanced reference.";

  const trackSummary = `${interpretation} Local scan estimates ${estimatedBpm} in ${estimatedKey}; peak section around ${formatTime(highlight.highlightStart)}. Edit tags below before merging into Suno.`;

  const moodSuggestion = { energy, aggression, darkness, complexity };
  const waveformPeaks = buildWaveformPeaks(channel);

  const report = {
    version: 2,
    fileName,
    duration,
    waveformPeaks,
    waveformSource: "sample",
    energy,
    aggression,
    brightness,
    darkness,
    complexity,
    bpm: bpmFinal,
    estimatedBpm,
    estimatedKey,
    loudnessDb,
    spectralCentroidHz: Math.round(centroidHz),
    ...highlight,
    trackSummary,
    ...suggestions,
    moodSuggestion,
  };

  report.summary = buildAudioAnalysisSummary(report);
  return report;
}

/**
 * Merge partial editor updates and rebuild summary.
 * @param {object|null} prev
 * @param {object} patch
 */
export function patchAudioAnalysis(prev, patch) {
  if (!prev) return null;
  const next = { ...prev, ...patch };
  if (patch.suggestedGenres) next.suggestedGenres = uniq(patch.suggestedGenres);
  if (patch.suggestedSubgenres) next.suggestedSubgenres = uniq(patch.suggestedSubgenres);
  if (patch.suggestedMoods) next.suggestedMoods = uniq(patch.suggestedMoods);
  if (patch.suggestedInstruments) next.suggestedInstruments = uniq(patch.suggestedInstruments);
  if (patch.suggestedSounds) next.suggestedSounds = uniq(patch.suggestedSounds);
  if (patch.suggestedRhythms) next.suggestedRhythms = uniq(patch.suggestedRhythms);
  if (typeof patch.bpm === "number") next.estimatedBpm = formatBpmLabel(patch.bpm);
  if ("highlightStart" in patch || "highlightEnd" in patch) {
    const norm = normalizeHighlightRange(
      next.duration,
      next.highlightStart,
      next.highlightEnd,
    );
    next.highlightStart = norm.highlightStart;
    next.highlightEnd = norm.highlightEnd;
    if (!patch.highlightLabel) next.highlightLabel = "Custom highlight section";
  }
  next.summary = buildAudioAnalysisSummary(next);
  return next;
}

/** @param {object|null} raw */
export function normalizeAudioAnalysis(raw) {
  if (!raw) return null;

  const bpmMatch = String(raw.estimatedBpm || "").match(/(\d+)/);
  const bpm =
    typeof raw.bpm === "number" && !Number.isNaN(raw.bpm)
      ? raw.bpm
      : bpmMatch
        ? Number(bpmMatch[1])
        : 120;

  const duration = Number(raw.duration) || 0;
  const fileName = raw.fileName || "audio";
  const hasPeaks = Array.isArray(raw.waveformPeaks) && raw.waveformPeaks.length >= 32;

  const next = {
    ...raw,
    version: 2,
    fileName,
    duration,
    energy: raw.energy ?? 50,
    aggression: raw.aggression ?? 50,
    brightness: raw.brightness ?? 50,
    darkness: raw.darkness ?? 50,
    complexity: raw.complexity ?? 50,
    bpm,
    estimatedBpm: raw.estimatedBpm || formatBpmLabel(bpm),
    estimatedKey: raw.estimatedKey || "Key unclear",
    loudnessDb: raw.loudnessDb ?? -20,
    trackSummary: raw.trackSummary || raw.summary?.split("\n")[0] || "",
    suggestedGenres: raw.suggestedGenres || [],
    suggestedSubgenres: raw.suggestedSubgenres || [],
    suggestedMoods: raw.suggestedMoods || [],
    suggestedInstruments: raw.suggestedInstruments || [],
    suggestedSounds: raw.suggestedSounds || [],
    suggestedRhythms: raw.suggestedRhythms || [],
    vocals: raw.vocals || "Mixed / uncertain",
    highlightLabel: raw.highlightLabel || "Full track",
    highlightStart: raw.highlightStart ?? 0,
    highlightEnd: raw.highlightEnd ?? duration,
    waveformPeaks: hasPeaks ? raw.waveformPeaks : [],
    waveformSource:
      raw.waveformSource || (hasPeaks ? "saved" : ""),
    audioCacheKey: raw.audioCacheKey || "",
    audioLookupKey:
      raw.audioLookupKey || (fileName && duration ? makeAudioLookupKey(fileName, duration) : ""),
    moodSuggestion: raw.moodSuggestion || {
      energy: raw.energy ?? 50,
      aggression: raw.aggression ?? 50,
      darkness: raw.darkness ?? 50,
      complexity: raw.complexity ?? 50,
    },
  };

  next.summary = buildAudioAnalysisSummary(next);
  return next;
}
