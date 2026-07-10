import { BLANK_STATE, DEFAULT_STATE } from "./music-config";
import { DEFAULT_LLM_SETTINGS } from "./co-producer-llm";
import { DEFAULT_STYLE_DNA_SETTINGS } from "./style-dna-settings";
import { normalizeLyricLanguage } from "./suno-lyric-languages";
import {
  PROJECT_PATCH_KEYS,
  SNAPSHOT_FIELD_KEYS,
  normalizeLoadPayloadFromFields,
} from "./project-schema";

export { PROJECT_PATCH_KEYS, SNAPSHOT_FIELD_KEYS };

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
    styleDnaSettings: DEFAULT_STYLE_DNA_SETTINGS,
    ...overrides,
  };
}

/**
 * Normalize persisted/imported payload into project state fields.
 * @param {Record<string, unknown>} data
 */
export function normalizeLoadPayload(data) {
  return normalizeLoadPayloadFromFields(data);
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
        notes: "",
        voiceRefFirstName: "",
        voiceRefLastName: "",
        voiceStyleLine: "",
        sunoPasteStyle: "",
        sunoPasteLyrics: "",
        sunoPasteActive: false,
      });
    default:
      return state;
  }
}

/**
 * Pick snapshot-shaped fields from a flat project + analyzer source object.
 * @param {Record<string, unknown>} source
 */
export function pickSnapshotFields(source) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of SNAPSHOT_FIELD_KEYS) {
    out[key] = source[key];
  }
  return out;
}

/**
 * Build autosave / undo snapshot from live project fields.
 * @param {string} appVersion
 * @param {Record<string, unknown>} fields
 */
export function buildProjectSnapshot(appVersion, fields) {
  return {
    appVersion,
    ...pickSnapshotFields(fields),
  };
}
