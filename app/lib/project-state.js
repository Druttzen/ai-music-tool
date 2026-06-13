import { BLANK_STATE, DEFAULT_STATE } from "./music-config";
import { DEFAULT_LLM_SETTINGS } from "./co-producer-llm";
import { normalizeLyricLanguage } from "./suno-lyric-languages";

/** @typedef {typeof DEFAULT_STATE & Record<string, unknown>} ProjectStateShape */

/**
 * Apply a patch where values may be updaters `(prev) => next`.
 * @param {Record<string, unknown>} state
 * @param {Record<string, unknown>} patch
 */
export function applyProjectPatch(state, patch) {
  const next = { ...state };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = typeof value === "function" ? value(state[key]) : value;
  }
  return next;
}

/**
 * @param {Record<string, unknown>} [overrides]
 */
export function createInitialProjectState(overrides = {}) {
  return {
    ...DEFAULT_STATE,
    promptEngine: DEFAULT_STATE.promptEngine ?? "Standard",
    guidedStep: 0,
    variations: [],
    history: [],
    selectedHistoryId: null,
    presetName: "",
    customPresets: {},
    copied: false,
    lyricsGenerateBusy: false,
    coProducerLlmSettings: DEFAULT_LLM_SETTINGS,
    ...overrides,
  };
}

/**
 * Normalize persisted/imported payload into project state fields.
 * @param {Record<string, unknown>} data
 */
export function normalizeLoadPayload(data) {
  if (!data || typeof data !== "object") return {};

  return {
    idea: data.idea ?? DEFAULT_STATE.idea,
    tempo: data.tempo ?? DEFAULT_STATE.tempo,
    structure: data.structure ?? DEFAULT_STATE.structure,
    selectedGenres: data.selectedGenres ?? DEFAULT_STATE.selectedGenres,
    selectedRhythms: data.selectedRhythms ?? DEFAULT_STATE.selectedRhythms,
    selectedSounds: data.selectedSounds ?? DEFAULT_STATE.selectedSounds,
    vocal: data.vocal ?? DEFAULT_STATE.vocal,
    mode: data.mode ?? DEFAULT_STATE.mode,
    proMode: data.proMode ?? DEFAULT_STATE.proMode,
    promptIntensity: data.promptIntensity ?? DEFAULT_STATE.promptIntensity,
    variationCount: data.variationCount ?? DEFAULT_STATE.variationCount,
    rules: data.rules ?? DEFAULT_STATE.rules,
    notes: data.notes ?? DEFAULT_STATE.notes,
    scores: data.scores ?? DEFAULT_STATE.scores,
    mood: data.mood ?? DEFAULT_STATE.mood,
    lyricTheme: data.lyricTheme ?? DEFAULT_STATE.lyricTheme,
    lyricLanguage: normalizeLyricLanguage(data.lyricLanguage ?? DEFAULT_STATE.lyricLanguage),
    lyricStructure: data.lyricStructure ?? DEFAULT_STATE.lyricStructure,
    lyricStyle: data.lyricStyle ?? DEFAULT_STATE.lyricStyle,
    lyricDensity: data.lyricDensity ?? DEFAULT_STATE.lyricDensity,
    promptFormat: data.promptFormat ?? DEFAULT_STATE.promptFormat,
    promptEngine: data.promptEngine ?? DEFAULT_STATE.promptEngine ?? "Standard",
    coProducerOutput: data.coProducerOutput ?? DEFAULT_STATE.coProducerOutput,
    generatedLyrics: data.generatedLyrics ?? DEFAULT_STATE.generatedLyrics,
    generatedLyricsStyle: data.generatedLyricsStyle ?? DEFAULT_STATE.generatedLyricsStyle ?? "",
    generatedHooks: data.generatedHooks ?? DEFAULT_STATE.generatedHooks,
    generatedHooksStyle: data.generatedHooksStyle ?? DEFAULT_STATE.generatedHooksStyle ?? "",
    lyricVariantSeed: data.lyricVariantSeed ?? DEFAULT_STATE.lyricVariantSeed ?? 0,
    lyricMode: data.lyricMode ?? DEFAULT_STATE.lyricMode,
    voiceRefFirstName: data.voiceRefFirstName ?? DEFAULT_STATE.voiceRefFirstName ?? "",
    voiceRefLastName: data.voiceRefLastName ?? DEFAULT_STATE.voiceRefLastName ?? "",
    voiceStyleLine: data.voiceStyleLine ?? DEFAULT_STATE.voiceStyleLine ?? "",
    instrumentalVocalFx: data.instrumentalVocalFx ?? DEFAULT_STATE.instrumentalVocalFx,
    guidedStep:
      typeof data.guidedStep === "number" && !Number.isNaN(data.guidedStep)
        ? Math.max(0, data.guidedStep)
        : 0,
    variations: Array.isArray(data.variations) ? data.variations : [],
    ...(Array.isArray(data.history) ? { history: data.history } : {}),
    selectedHistoryId: data.selectedHistoryId ?? null,
  };
}

/**
 * @param {Record<string, unknown>} state
 * @param {{ type: string, payload?: Record<string, unknown> }} action
 */
export function projectReducer(state, action) {
  switch (action.type) {
    case "PATCH":
      return applyProjectPatch(state, action.payload ?? {});
    case "LOAD":
      return applyProjectPatch(state, normalizeLoadPayload(action.payload));
    case "RESET_BLANK":
      return applyProjectPatch(createInitialProjectState(), {
        ...BLANK_STATE,
        lyricLanguage: normalizeLyricLanguage(BLANK_STATE.lyricLanguage),
        guidedStep: 0,
        variations: [],
        history: [],
        selectedHistoryId: null,
        generatedLyrics: "",
        generatedLyricsStyle: "",
        generatedHooks: "",
        generatedHooksStyle: "",
        coProducerOutput: "",
        lyricVariantSeed: 0,
        presetName: "",
        copied: false,
        lyricsGenerateBusy: false,
      });
    default:
      return state;
  }
}

/** Keys exposed as `setX` helpers from {@link useProjectState}. */
export const PROJECT_PATCH_KEYS = [
  "idea",
  "tempo",
  "structure",
  "selectedGenres",
  "selectedRhythms",
  "selectedSounds",
  "vocal",
  "mode",
  "proMode",
  "promptIntensity",
  "variationCount",
  "rules",
  "notes",
  "scores",
  "mood",
  "lyricTheme",
  "lyricLanguage",
  "lyricStructure",
  "lyricStyle",
  "lyricDensity",
  "promptFormat",
  "promptEngine",
  "coProducerOutput",
  "generatedLyrics",
  "generatedLyricsStyle",
  "generatedHooks",
  "generatedHooksStyle",
  "lyricVariantSeed",
  "lyricMode",
  "voiceRefFirstName",
  "voiceRefLastName",
  "voiceStyleLine",
  "instrumentalVocalFx",
  "guidedStep",
  "variations",
  "history",
  "selectedHistoryId",
  "presetName",
  "customPresets",
  "copied",
  "lyricsGenerateBusy",
  "coProducerLlmSettings",
];
