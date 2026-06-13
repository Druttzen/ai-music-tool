/**
 * Character voice presets — Suno prompt DNA from analyzed traits (not voice cloning).
 */

import { safeLocalStorage } from "./safe-local-storage";

export const CHARACTER_VOICE_PRESET_KEY = "ai_music_creator_character_voice_presets_v1";
export const CHARACTER_VOICE_PRESETS_CHANGED_EVENT = "character-voice-presets-changed";

export const VOICE_CHARACTER_DISCLAIMER =
  "Analyzes delivery traits (register, breath, vibrato, dynamics) for Suno Style/Lyrics direction only. " +
  "Not voice cloning or impersonation. Use only material you have rights to reference. " +
  "YouTube links store metadata — upload exported audio for analysis.";

/**
 * @param {object} analysis
 * @param {{ selectedGenres?: string[], moodWords?: string, characterName?: string, youtubeTitle?: string }} [ctx]
 */
export function buildSunoLinesFromVoiceCharacter(analysis, ctx = {}) {
  const genres = ctx.selectedGenres || [];
  const name = String(ctx.characterName || analysis?.characterLabel || "Custom character").trim();

  const traitLine = [
    analysis?.registerLabel,
    ...(analysis?.textureTags || []).slice(0, 4),
    analysis?.deliveryPace,
  ]
    .filter(Boolean)
    .join(", ");

  const compactStyle = [
    name,
    analysis?.registerLabel,
    (analysis?.textureTags || []).slice(0, 2).join(" "),
    genres[0] || "track",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 120);

  const lyricTag =
    `[Vocal character: ${name} — ${(analysis?.textureTags || ["studio lead"]).slice(0, 2).join(", ")}]`;

  return {
    voiceStyleLine: compactStyle,
    voiceStyleCompact: { style: compactStyle, lyricTag },
    vocalRole: analysis?.suggestedVocalRole || "Male Lead",
    rulesAddition: `Match lead vocal to analyzed character: ${traitLine}.`,
  };
}

/**
 * @param {object} preset
 * @param {{ selectedGenres?: string[], moodWords?: string }} ctx
 */
export function regenerateCharacterVoicePreset(preset, ctx = {}) {
  if (!preset?.analysis) return null;
  const lines = buildSunoLinesFromVoiceCharacter(preset.analysis, {
    selectedGenres: ctx.selectedGenres,
    moodWords: ctx.moodWords,
    characterName: preset.name,
    youtubeTitle: preset.source?.youtubeTitle,
  });
  return {
    ...lines,
    characterLabel: preset.analysis.characterLabel,
    analysis: preset.analysis,
  };
}

/**
 * @param {string} name
 * @param {object} analysis
 * @param {object} lines
 * @param {object} [source]
 */
export function createCharacterVoicePreset(name, analysis, lines, source = {}) {
  return {
    id: `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(name).trim(),
    createdAt: new Date().toISOString(),
    analysis,
    source,
    voiceStyleLine: lines.voiceStyleLine,
    voiceStyleCompact: lines.voiceStyleCompact,
    vocalRole: lines.vocalRole,
    rulesAddition: lines.rulesAddition,
  };
}

export const CHARACTER_PRESET_EXPORT_KIND = "character_voice_presets";

/**
 * @param {unknown} preset
 * @param {string} [fallbackName]
 */
export function normalizeCharacterPresetRecord(preset, fallbackName = "") {
  if (!preset || typeof preset !== "object") return null;
  const name = String(preset.name || fallbackName || "").trim();
  const analysis = preset.analysis;
  if (!name || !analysis || typeof analysis !== "object") return null;
  if (!analysis.characterLabel || !preset.voiceStyleLine) return null;

  const textureTags = Array.isArray(analysis.textureTags)
    ? analysis.textureTags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];

  return {
    id: String(preset.id || `cv_${name.replace(/\s+/g, "_").toLowerCase()}`),
    name,
    createdAt: preset.createdAt || new Date().toISOString(),
    analysis: { ...analysis, textureTags },
    source: preset.source && typeof preset.source === "object" ? preset.source : {},
    voiceStyleLine: String(preset.voiceStyleLine),
    voiceStyleCompact:
      preset.voiceStyleCompact && typeof preset.voiceStyleCompact === "object"
        ? preset.voiceStyleCompact
        : { style: "", lyricTag: "" },
    vocalRole: preset.vocalRole || analysis.suggestedVocalRole || "Male Lead",
    rulesAddition: preset.rulesAddition || "",
  };
}

/**
 * @param {unknown} raw
 */
export function normalizeCharacterPresetsMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  /** @type {Record<string, object>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeCharacterPresetRecord(value, key);
    if (normalized) out[normalized.name] = normalized;
  }
  return out;
}

/**
 * @param {Record<string, object>} presets
 * @param {string} appVersion
 */
export function serializeCharacterPresetsExport(presets, appVersion) {
  return {
    kind: CHARACTER_PRESET_EXPORT_KIND,
    appVersion,
    exportedAt: new Date().toISOString(),
    presets,
  };
}

/**
 * @param {unknown} raw
 */
export function parseCharacterPresetsImport(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON");
  }
  if (Array.isArray(raw)) {
    throw new Error("Expected preset map or export envelope");
  }
  const envelope = /** @type {Record<string, unknown>} */ (raw);
  if (envelope.kind === CHARACTER_PRESET_EXPORT_KIND && envelope.presets) {
    return normalizeCharacterPresetsMap(envelope.presets);
  }
  return normalizeCharacterPresetsMap(envelope);
}

/**
 * @param {Record<string, object>} existing
 * @param {Record<string, object>} imported
 */
export function mergeCharacterPresetsMaps(existing, imported) {
  return { ...existing, ...imported };
}

/**
 * @returns {Record<string, object>}
 */
export function loadCharacterPresetsFromStorage() {
  const raw = safeLocalStorage.getJSON(CHARACTER_VOICE_PRESET_KEY, {});
  return normalizeCharacterPresetsMap(raw);
}

/**
 * @param {Record<string, object>} presets
 */
export function saveCharacterPresetsToStorage(presets) {
  return safeLocalStorage.setJSON(CHARACTER_VOICE_PRESET_KEY, presets);
}

export function notifyCharacterPresetsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHARACTER_VOICE_PRESETS_CHANGED_EVENT));
  }
}

/**
 * @param {unknown} presets
 * @param {{ merge?: boolean }} [options]
 */
export function persistCharacterVoicePresets(presets, { merge = true } = {}) {
  const normalized = normalizeCharacterPresetsMap(presets);
  const next = merge
    ? mergeCharacterPresetsMaps(loadCharacterPresetsFromStorage(), normalized)
    : normalized;
  const result = saveCharacterPresetsToStorage(next);
  if (result.ok) notifyCharacterPresetsChanged();
  return { ...result, count: Object.keys(normalized).length, presets: next };
}

/**
 * @param {unknown} raw
 * @returns {Record<string, object> | null}
 */
export function extractCharacterVoicePresetsFromProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(raw, "characterVoicePresets")) return null;
  return normalizeCharacterPresetsMap(raw.characterVoicePresets);
}

/**
 * @param {Record<string, unknown>} projectPayload
 * @param {Record<string, object>} [presets]
 */
export function attachCharacterVoicePresetsToProjectExport(projectPayload, presets) {
  const map = presets ?? loadCharacterPresetsFromStorage();
  if (!Object.keys(map).length) return projectPayload;
  return { ...projectPayload, characterVoicePresets: map };
}
