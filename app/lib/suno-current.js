/** Official product facts checked 2026-10-10; prompt catalogs are separate community material. */
export const SUNO_CURRENT = {
  verifiedAt: "2026-10-10",
  modelFamily: "v6",
  models: [
    { id: "v6", plans: ["Pro", "Premier"], purpose: "Refine a clear musical direction" },
    { id: "v6-wild", plans: ["Pro", "Premier"], purpose: "Explore more varied interpretations" },
    { id: "v6-mini", plans: ["Free", "Pro", "Premier"], purpose: "Fast idea generation" },
  ],
  previousModelsRetired: true,
  standardGeneration: { songs: 2, credits: 10, additionalMediaMayCostMore: true },
  maxMode: { costsMore: true, exactCredits: null },
  audioUploadMaxSeconds: { Free: 480, Pro: 1800, Premier: 1800 },
  customModels: { minSongs: 6, maxModels: 3, plans: ["Pro", "Premier"], private: true },
  voices: { recordingMinSeconds: 15, recordingMaxSeconds: 240, selectedExcerptMaxSeconds: 120 },
  // Local copy budgets, not independently verified v6 platform hard limits.
  copyBudgets: { style: 1000, lyrics: 5000, officialV6LimitVerified: false },
  sources: {
    models: "https://help.suno.com/en/articles/13924481",
    plans: "https://suno.com/pricing",
    updates: "https://www.suno.com/release-notes",
    customModels: "https://help.suno.com/en/articles/11362497",
    voices: "https://help.suno.com/en/articles/11362369",
    myTaste: "https://help.suno.com/en/articles/11362561",
    genreWheel: "https://suno.com/labs/genre-wheel",
  },
  latestUpdates: [
    { date: "2026-10-08", text: "Studio: improved beat alignment, clip stretching and adjustable fade curves" },
    { date: "2026-10-05", text: "Album publishing" },
    { date: "2026-10-01", text: "Speech beta combines spoken audio with a soundtrack" },
    { date: "2026-09-17", text: "Studio MIDI improvements" },
  ],
};

export const SUNO_DRAFT_GUIDANCE =
  "Audition locally, then upload your chosen audio to Suno v6 with a clear description of what to preserve and what to change. Set Variety to 0 when you want to keep control of your style tags. Standard mode suits short drafts; Max Mode costs more and can help with closer covers or longer songs. Suno can reinterpret the audio, so compare its result before spending more credits.";

export function buildSunoUploadBrief({ style = "", lyrics = "", analysis = {} } = {}) {
  const params = analysis.musicGenSettings;
  return [
    `Suno ${SUNO_CURRENT.modelFamily} — local draft handoff`,
    `Product data checked: ${SUNO_CURRENT.verifiedAt}`,
    "",
    "DIRECTION",
    "Use the attached audio as the musical reference. Preserve its main motif, groove, tempo and core instrumentation. Develop it into a coherent full song with a clear opening, contrasting sections and a deliberate ending. Improve clarity and balance while keeping the musical identity.",
    "",
    "STYLE",
    String(style || analysis.musicGenPrompt || "").trim(),
    "",
    "LYRICS / INSTRUMENTAL DIRECTION",
    String(lyrics || "Instrumental; no sung words.").trim(),
    "",
    "LOCAL SOURCE",
    `Model: ${analysis.musicGenModel || analysis.sourceEngine || "imported audio"}`,
    `Duration: ${analysis.duration ?? analysis.musicGenDurationSec ?? "unknown"} seconds`,
    ...(params ? [`Generation settings: ${JSON.stringify(params)}`] : []),
    ...(analysis.compositionPlan ? [`Local AI composition plan: ${JSON.stringify(analysis.compositionPlan)}`] : []),
    ...(analysis.musicGenSearch ? [`Local comparison: ${analysis.musicGenSearch.note}`, `Chosen take: ${analysis.musicGenSearch.selected_index + 1}`] : []),
    "",
    SUNO_DRAFT_GUIDANCE,
    `Reference: ${SUNO_CURRENT.sources.models}`,
  ].join("\n");
}
