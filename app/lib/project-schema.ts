/**
 * Single source of truth for project-state fields.
 *
 * Two complementary artifacts live here:
 *  1. {@link PROJECT_FIELDS} — a role registry (`load` / `patch` / `snapshot`)
 *     that derives the key arrays and the load normalizer, removing the drift
 *     risk between the previously hand-maintained parallel arrays.
 *  2. {@link ProjectStateSchema} — a Zod schema that formalizes field *value*
 *     types and provides the {@link ProjectState} type. This is the contract the
 *     Rust DSP core and Python AI sidecar serialize against across the IPC seam.
 */

import { z } from "zod";
import { DEFAULT_STATE } from "./music-config";
import { normalizeLyricLanguage } from "./suno-lyric-languages";

type LoadData = Record<string, unknown>;

export interface ProjectFieldDef {
  key: string;
  load: boolean;
  patch: boolean;
  snapshot: boolean;
  /** Custom load normalizer; defaults to `data[key] ?? DEFAULT_STATE[key]`. */
  normalize?: (data: LoadData) => unknown;
  /** When set, the field is only emitted on load if this returns true. */
  includeOnLoad?: (data: LoadData) => boolean;
}

function field(key: string, opts: Partial<Omit<ProjectFieldDef, "key">> = {}): ProjectFieldDef {
  return {
    key,
    load: Boolean(opts.load),
    patch: Boolean(opts.patch),
    snapshot: Boolean(opts.snapshot),
    normalize: opts.normalize,
    includeOnLoad: opts.includeOnLoad,
  };
}

/** load + patch + snapshot with the default `?? DEFAULT_STATE[key]` load behavior. */
const core = (key: string): ProjectFieldDef =>
  field(key, { load: true, patch: true, snapshot: true });

const defaults = DEFAULT_STATE as Record<string, unknown>;

/**
 * Ordered field registry. Order is preserved into the derived arrays purely for
 * readable diffs; consumers treat the arrays as sets.
 */
export const PROJECT_FIELDS: ProjectFieldDef[] = [
  core("idea"),
  core("tempo"),
  core("structure"),
  core("selectedGenres"),
  core("selectedRhythms"),
  core("selectedSounds"),
  core("vocal"),
  core("mode"),
  core("proMode"),
  core("promptIntensity"),
  core("variationCount"),
  core("rules"),
  core("notes"),
  core("scores"),
  core("mood"),

  // Analyzer references: persisted in snapshots, but not patchable setters and
  // not part of the load-normalized payload (managed by the analyzer hooks).
  field("audioAnalysis", { snapshot: true }),
  field("imageAnalysis", { snapshot: true }),

  core("lyricTheme"),
  field("lyricLanguage", {
    load: true,
    patch: true,
    snapshot: true,
    normalize: (d) => normalizeLyricLanguage(d.lyricLanguage ?? defaults.lyricLanguage),
  }),
  core("lyricStructure"),
  core("lyricStyle"),
  core("lyricDensity"),
  core("promptFormat"),
  core("promptEngine"),
  core("coProducerOutput"),
  core("generatedLyrics"),
  core("generatedLyricsStyle"),
  core("generatedHooks"),
  core("generatedHooksStyle"),
  core("lyricVariantSeed"),
  core("lyricMode"),
  core("voiceRefFirstName"),
  core("voiceRefLastName"),
  core("voiceStyleLine"),
  core("instrumentalVocalFx"),
  core("sunoPasteStyle"),
  core("sunoPasteLyrics"),
  core("sunoPasteActive"),

  field("guidedStep", {
    load: true,
    patch: true,
    snapshot: true,
    normalize: (d) =>
      typeof d.guidedStep === "number" && !Number.isNaN(d.guidedStep)
        ? Math.max(0, d.guidedStep)
        : 0,
  }),
  field("variations", {
    load: true,
    patch: true,
    snapshot: true,
    normalize: (d) => (Array.isArray(d.variations) ? d.variations : []),
  }),
  field("history", {
    load: true,
    patch: true,
    snapshot: true,
    // Only restore history when the payload actually carries an array, so a
    // partial LOAD does not wipe existing in-memory history.
    includeOnLoad: (d) => Array.isArray(d.history),
    normalize: (d) => d.history,
  }),
  field("selectedHistoryId", {
    load: true,
    patch: true,
    snapshot: true,
    normalize: (d) => d.selectedHistoryId ?? null,
  }),

  // Runtime / settings: patchable, but never loaded from imported JSON or
  // captured in snapshots.
  field("presetName", { patch: true }),
  field("customPresets", { patch: true }),
  field("copied", { patch: true }),
  field("lyricsGenerateBusy", { patch: true }),
  field("coProducerLlmSettings", { patch: true }),
  field("styleDnaSettings", { patch: true }),
];

/** Keys exposed as `setX` helpers and accepted by the `PATCH` action. */
export const PROJECT_PATCH_KEYS: string[] = PROJECT_FIELDS.filter((f) => f.patch).map((f) => f.key);

/** Project + analyzer keys persisted in autosave / undo snapshots (excludes appVersion). */
export const SNAPSHOT_FIELD_KEYS: string[] = PROJECT_FIELDS.filter((f) => f.snapshot).map(
  (f) => f.key,
);

/** Fields normalized from a persisted/imported payload. */
const LOAD_FIELDS = PROJECT_FIELDS.filter((f) => f.load);

/** Normalize a persisted/imported payload into project-state fields. */
export function normalizeLoadPayloadFromFields(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const source = data as LoadData;

  const out: Record<string, unknown> = {};
  for (const f of LOAD_FIELDS) {
    if (f.includeOnLoad && !f.includeOnLoad(source)) continue;
    out[f.key] = f.normalize ? f.normalize(source) : source[f.key] ?? defaults[f.key];
  }
  return out;
}

// --- Zod value contract -----------------------------------------------------

const stringList = z.array(z.string());
const scoresSchema = z.object({
  bass: z.number(),
  rhythm: z.number(),
  identity: z.number(),
  clarity: z.number(),
});
const moodSchema = z.object({
  darkness: z.number(),
  energy: z.number(),
  aggression: z.number(),
  emotion: z.number(),
  complexity: z.number(),
  space: z.number(),
});

/**
 * Value-level schema for the portable project contract (excludes analyzer refs
 * and local-only settings). Used to type and validate project payloads that
 * cross the UI ↔ Rust ↔ Python boundaries.
 */
export const ProjectStateSchema = z.object({
  idea: z.string(),
  tempo: z.string(),
  structure: z.string(),
  selectedGenres: stringList,
  selectedRhythms: stringList,
  selectedSounds: stringList,
  vocal: z.string(),
  mode: z.string(),
  proMode: z.boolean(),
  promptIntensity: z.number(),
  variationCount: z.number(),
  rules: z.string(),
  notes: z.string(),
  scores: scoresSchema,
  mood: moodSchema,
  lyricTheme: z.string(),
  lyricLanguage: z.string(),
  lyricStructure: z.string(),
  lyricStyle: z.string(),
  lyricDensity: z.number(),
  promptFormat: z.string(),
  promptEngine: z.string(),
  coProducerOutput: z.string(),
  generatedLyrics: z.string(),
  generatedLyricsStyle: z.string(),
  generatedHooks: z.string(),
  generatedHooksStyle: z.string(),
  lyricVariantSeed: z.number(),
  lyricMode: z.string(),
  voiceRefFirstName: z.string(),
  voiceRefLastName: z.string(),
  voiceStyleLine: z.string(),
  instrumentalVocalFx: z.boolean(),
  sunoPasteStyle: z.string(),
  sunoPasteLyrics: z.string(),
  sunoPasteActive: z.boolean(),
  guidedStep: z.number(),
  variations: z.array(z.unknown()),
  history: z.array(z.unknown()),
  selectedHistoryId: z.string().nullable(),
});

export type ProjectState = z.infer<typeof ProjectStateSchema>;

/** Keys present in the portable Zod contract. */
export const PROJECT_SCHEMA_KEYS = Object.keys(ProjectStateSchema.shape);
