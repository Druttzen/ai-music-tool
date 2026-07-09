import { structureToSectionTags } from "./suno-guided-workflow";

function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function splitLyricBlocks(lyrics) {
  const text = String(lyrics || "").trim();
  if (!text) return [];
  const parts = text
    .split(/(?=\n?\[[^\]]+\])/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  return text
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function countSingableLines(block) {
  return String(block || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line)).length;
}

function extractSectionName(block, fallback) {
  const match = String(block || "").match(/^\[([^\]]+)\]/);
  return normalizeText(match?.[1] || fallback);
}

function inferSectionDuration(totalDuration, sectionCount, index) {
  if (!totalDuration || !sectionCount) return null;
  const usable = Math.max(20, totalDuration * 0.88);
  const introPad = Math.min(12, totalDuration * 0.06);
  const each = usable / sectionCount;
  return {
    start: Math.max(0, introPad + index * each),
    end: Math.min(totalDuration, introPad + (index + 1) * each),
  };
}

function formatTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "--:--";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function buildSections({ lyrics, lyricStructure, duration }) {
  const blocks = splitLyricBlocks(lyrics);
  const fallbackTags = structureToSectionTags(lyricStructure || "verse -> chorus -> verse -> chorus");
  const sectionCount = Math.max(blocks.length, fallbackTags.length, 1);
  const source = blocks.length ? blocks : fallbackTags.map((tag) => `[${tag}]`);

  return source.map((block, index) => {
    const timing = inferSectionDuration(duration, sectionCount, index);
    const name = extractSectionName(block, fallbackTags[index] || `Section ${index + 1}`);
    return {
      name,
      start: timing?.start ?? null,
      end: timing?.end ?? null,
      lineCount: countSingableLines(block),
      text: block,
    };
  });
}

function resolveLyrics(input) {
  return (
    String(input.vocalEmbedLyrics || "").trim() ||
    String(input.generatedLyrics || "").trim() ||
    String(input.lyricTheme || "").trim()
  );
}

function resolveVoiceStyle(input) {
  return (
    normalizeText(input.voiceStyleCompact?.style) ||
    normalizeText(input.voiceStyleLine) ||
    normalizeText(input.vocal) ||
    "neutral studio lead"
  );
}

export function buildVocalEmbedPlan(input = {}) {
  const duration = Number(input.audioAnalysis?.duration || 0);
  const bpm = normalizeText(input.audioAnalysis?.estimatedBpm || input.tempo || "120 BPM");
  const key = normalizeText(input.audioAnalysis?.estimatedKey || "Key unknown");
  const lyrics = resolveLyrics(input);
  const voiceStyle = resolveVoiceStyle(input);
  const hasInstrumental = !!input.audioAnalysis;
  const hasLyrics = lyrics.length > 0;
  const hasVoiceStyle = !!normalizeText(input.voiceStyleCompact?.style || input.voiceStyleLine);
  const sections = buildSections({
    lyrics,
    lyricStructure: input.lyricStructure,
    duration,
  });

  const warnings = [];
  if (!hasInstrumental) warnings.push("Add or analyze the existing instrumental track first.");
  if (!hasLyrics) warnings.push("Add lyrics or generate a lyric draft.");
  if (!hasVoiceStyle) warnings.push("Analyze or load a Voice Character preset for custom vocal style.");
  if (duration && duration < 30) warnings.push("Track is short; full song vocal placement may feel cramped.");
  if (sections.some((s) => s.lineCount > 8)) warnings.push("Some sections are dense; split long lyric blocks for cleaner vocal timing.");

  const stage = hasInstrumental && hasLyrics && hasVoiceStyle ? "ready" : "draft";
  const hasGuide = !!(input.guideVocalAttached || input.guideVocalFile);
  const guideForLyricTiming =
    hasGuide && hasLyrics && input.guideForLyricTiming !== false;
  const sidecarMode =
    guideForLyricTiming || (hasLyrics && !hasGuide)
      ? "lyrics-to-vocal-synthesis"
      : hasGuide
        ? "guide-vocal-conversion"
        : "lyrics-to-vocal-synthesis";
  const mixPlan = {
    vocalTargetLufs: -18,
    instrumentalDuckDb: -4,
    vocalHighPassHz: 90,
    vocalPresenceBoost: "2-5 kHz",
    sendFx: "short plate reverb + tempo delay",
    exportFormat: "wav",
  };

  const sidecarBrief = [
    "Vocal Embed Studio local engine brief",
    `Mode: ${sidecarMode}`,
    hasGuide && sidecarMode === "lyrics-to-vocal-synthesis"
      ? "Guide vocal: refines lyric word timing (MFA when configured, onset fallback otherwise)"
      : hasGuide
        ? "Guide vocal: conversion + placement-mix overlay"
        : "",
    `Instrumental: ${input.audioAnalysis?.fileName || "missing"}`,
    `Duration: ${duration ? formatTime(duration) : "unknown"}`,
    `Tempo: ${bpm}`,
    `Key: ${key}`,
    `Genres: ${(input.selectedGenres || []).join(", ") || "unspecified"}`,
    `Voice style: ${voiceStyle}`,
    input.voiceStyleCompact?.lyricTag ? `Lyric voice tag: ${input.voiceStyleCompact.lyricTag}` : "",
    "Sections:",
    ...sections.map((s) => `- ${formatTime(s.start)}-${formatTime(s.end)} ${s.name}: ${s.lineCount} lyric lines`),
    "Mix:",
    `- Vocal target ${mixPlan.vocalTargetLufs} LUFS, duck instrumental ${mixPlan.instrumentalDuckDb} dB under vocal`,
    `- HPF ${mixPlan.vocalHighPassHz} Hz, presence ${mixPlan.vocalPresenceBoost}, ${mixPlan.sendFx}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    stage,
    hasInstrumental,
    hasLyrics,
    hasVoiceStyle,
    duration,
    bpm,
    key,
    lyrics,
    voiceStyle,
    sections,
    warnings,
    sidecarMode,
    guideForLyricTiming: guideForLyricTiming && hasGuide,
    sidecarBrief,
    mixPlan,
  };
}

export function buildVocalEmbedExport(plan) {
  return {
    kind: "vocal_embed_plan",
    version: 1,
    createdAt: new Date().toISOString(),
    plan,
  };
}

/**
 * Merge MFA/heuristic aligned words from a preview into plan sections (by index).
 * @param {object} plan
 * @param {{ sections?: object[] }|null} alignPreview
 */
export function mergeAlignPreviewIntoPlan(plan, alignPreview) {
  if (!plan || !alignPreview?.sections?.length) return plan;
  const sections = (plan.sections || []).map((section, index) => {
    const aligned = alignPreview.sections[index];
    if (!aligned?.alignedWords?.length) return section;
    return { ...section, alignedWords: aligned.alignedWords };
  });
  return {
    ...plan,
    sections,
    alignMethod: alignPreview.align_method || null,
    alignWordCount: alignPreview.word_count ?? null,
  };
}

/**
 * @param {object} plan
 * @param {{ sections?: object[] }|null} [alignPreview]
 */
export function buildVocalEmbedExportEnvelope(plan, alignPreview = null) {
  const merged = alignPreview ? mergeAlignPreviewIntoPlan(plan, alignPreview) : plan;
  return buildVocalEmbedExport(merged);
}

export { formatTime as formatVocalEmbedTime };
