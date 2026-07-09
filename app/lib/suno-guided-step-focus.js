import { SUNO_GUIDED_STEPS, getStepCount } from "./suno-guided-workflow";

/** Stable panel ids used by layout columns. */
export const GUIDED_PANEL_IDS = {
  guidedPath: "guidedPath",
  maestro: "maestro",
  idea: "idea",
  lyricStyle: "lyricStyle",
  voiceStyle: "voiceStyle",
  voiceCharacter: "voiceCharacter",
  vocalEmbed: "vocalEmbed",
  analyzers: "analyzers",
  styleDna: "styleDna",
  mood: "mood",
  musicControls: "musicControls",
  coProducerQuick: "coProducerQuick",
  coProducer: "coProducer",
  sunoReimport: "sunoReimport",
  variations: "variations",
  proMode: "proMode",
  stylePresets: "stylePresets",
  saveLoad: "saveLoad",
  mode: "mode",
  proModeLeft: "proModeLeft",
  promptPreview: "promptPreview",
  sunoValidator: "sunoValidator",
  sunoLanguageIndex: "sunoLanguageIndex",
  history: "history",
  trackScoring: "trackScoring",
};

const ALWAYS_VISIBLE = new Set([GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro, GUIDED_PANEL_IDS.saveLoad]);

/** @type {Record<number, { center: string[], left: string[], right: string[] }>} */
const STEP_PANELS = {
  0: {
    center: [GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro],
    left: [GUIDED_PANEL_IDS.stylePresets, GUIDED_PANEL_IDS.saveLoad],
    right: [GUIDED_PANEL_IDS.promptPreview],
  },
  1: {
    center: [GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro, GUIDED_PANEL_IDS.mood],
    left: [GUIDED_PANEL_IDS.mode, GUIDED_PANEL_IDS.saveLoad],
    right: [GUIDED_PANEL_IDS.promptPreview],
  },
  2: {
    center: [GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro, GUIDED_PANEL_IDS.musicControls],
    left: [GUIDED_PANEL_IDS.saveLoad],
    right: [GUIDED_PANEL_IDS.promptPreview, GUIDED_PANEL_IDS.sunoLanguageIndex],
  },
  3: {
    center: [
      GUIDED_PANEL_IDS.guidedPath,
      GUIDED_PANEL_IDS.maestro,
      GUIDED_PANEL_IDS.musicControls,
      GUIDED_PANEL_IDS.proMode,
    ],
    left: [GUIDED_PANEL_IDS.saveLoad, GUIDED_PANEL_IDS.proModeLeft],
    right: [GUIDED_PANEL_IDS.promptPreview, GUIDED_PANEL_IDS.sunoLanguageIndex],
  },
  4: {
    center: [GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro, GUIDED_PANEL_IDS.idea, GUIDED_PANEL_IDS.proMode],
    left: [GUIDED_PANEL_IDS.saveLoad, GUIDED_PANEL_IDS.proModeLeft],
    right: [GUIDED_PANEL_IDS.promptPreview],
  },
  5: {
    center: [
      GUIDED_PANEL_IDS.guidedPath,
      GUIDED_PANEL_IDS.maestro,
      GUIDED_PANEL_IDS.lyricStyle,
      GUIDED_PANEL_IDS.coProducerQuick,
      GUIDED_PANEL_IDS.coProducer,
    ],
    left: [GUIDED_PANEL_IDS.saveLoad],
    right: [GUIDED_PANEL_IDS.promptPreview],
  },
  6: {
    center: [
      GUIDED_PANEL_IDS.guidedPath,
      GUIDED_PANEL_IDS.maestro,
      GUIDED_PANEL_IDS.voiceStyle,
      GUIDED_PANEL_IDS.voiceCharacter,
      GUIDED_PANEL_IDS.analyzers,
      GUIDED_PANEL_IDS.coProducer,
      GUIDED_PANEL_IDS.variations,
    ],
    left: [GUIDED_PANEL_IDS.saveLoad, GUIDED_PANEL_IDS.proModeLeft],
    right: [
      GUIDED_PANEL_IDS.promptPreview,
      GUIDED_PANEL_IDS.sunoValidator,
      GUIDED_PANEL_IDS.sunoLanguageIndex,
    ],
  },
  7: {
    center: [GUIDED_PANEL_IDS.guidedPath, GUIDED_PANEL_IDS.maestro, GUIDED_PANEL_IDS.sunoReimport],
    left: [GUIDED_PANEL_IDS.saveLoad],
    right: [GUIDED_PANEL_IDS.promptPreview, GUIDED_PANEL_IDS.sunoValidator, GUIDED_PANEL_IDS.history],
  },
};

function clampStep(step) {
  const max = getStepCount() - 1;
  if (typeof step !== "number" || Number.isNaN(step)) return 0;
  return Math.min(max, Math.max(0, step));
}

function moodTouched(mood) {
  if (!mood || typeof mood !== "object") return false;
  return Object.values(mood).some((v) => typeof v === "number" && v !== 50);
}

function hasInstrumentalSafetyRule(rules, instrumentalVocalFx) {
  if (instrumentalVocalFx) return true;
  return String(rules || "")
    .toLowerCase()
    .includes("no vocal");
}

/**
 * @param {number} step
 * @param {string} promptEngine
 * @returns {{ center: Set<string>, left: Set<string>, right: Set<string> }}
 */
export function getGuidedPanelVisibility(step, promptEngine) {
  if (promptEngine !== "Suno-like") {
    const all = new Set(Object.values(GUIDED_PANEL_IDS));
    return { center: all, left: all, right: all };
  }

  const idx = clampStep(step);
  const map = STEP_PANELS[idx] || STEP_PANELS[0];
  const toSet = (ids) => new Set([...ALWAYS_VISIBLE, ...ids]);
  return {
    center: toSet(map.center),
    left: toSet(map.left),
    right: toSet(map.right),
  };
}

/**
 * @param {string} panelId
 * @param {"center"|"left"|"right"} column
 * @param {number} step
 * @param {string} promptEngine
 * @param {boolean} showAll
 */
export function isGuidedPanelVisible(panelId, column, step, promptEngine, showAll = false) {
  if (showAll || promptEngine !== "Suno-like") return true;
  const visibility = getGuidedPanelVisibility(step, promptEngine);
  return visibility[column]?.has(panelId) ?? false;
}

/**
 * @typedef {{ id: string, title: string, description: string, action: string }} GuidedCoachImprovement
 */

/**
 * @param {Record<string, unknown>} snapshot
 * @returns {{
 *   step: number,
 *   stepName: string,
 *   complete: boolean,
 *   missing: string[],
 *   improvements: GuidedCoachImprovement[],
 *   nextStepName: string | null,
 * }}
 */
export function evaluateGuidedStepCoach(snapshot = {}) {
  const step = clampStep(snapshot.guidedStep);
  const cur = SUNO_GUIDED_STEPS[step] || SUNO_GUIDED_STEPS[0];
  const next = SUNO_GUIDED_STEPS[step + 1];
  const missing = [];
  /** @type {GuidedCoachImprovement[]} */
  const improvements = [];

  const genres = snapshot.selectedGenres || [];
  const rhythms = snapshot.selectedRhythms || [];
  const sounds = snapshot.selectedSounds || [];
  const tempo = String(snapshot.tempo || "").trim();
  const vocal = String(snapshot.vocal || "").trim();
  const idea = String(snapshot.idea || "").trim();
  const structure = String(snapshot.structure || "").trim();
  const rules = String(snapshot.rules || "").trim();
  const lyricTheme = String(snapshot.lyricTheme || "").trim();
  const lyricStyle = String(snapshot.lyricStyle || "").trim();
  const generatedLyrics = String(snapshot.generatedLyrics || "").trim();
  const sunoWarnings = snapshot.sunoWarnings || [];

  if (step === 0) {
    if (!genres.length) missing.push("Pick at least one genre or load a factory preset.");
    if (!tempo) missing.push("Set tempo (preset or Pro Mode).");
    if (!vocal) missing.push("Choose Lyrics or Instrumental on step 1.");
    if (!genres.length) {
      improvements.push({
        id: "fix-suno-basics",
        title: "Fill missing style DNA",
        description: "Add default genres, sounds, and rhythm anchors so Suno has a clear identity.",
        action: "fixSunoWarnings",
      });
    }
  }

  if (step === 1) {
    if (!genres.length || !tempo) missing.push("Finish style preset basics first (genres + tempo).");
    if (!moodTouched(snapshot.mood)) {
      missing.push("Move at least one Mood Slider off center (50) to lock the feel.");
      improvements.push({
        id: "nudge-mood",
        title: "Set a stronger mood profile",
        description: "I can apply genre anchors and a balanced mood tilt based on your genres.",
        action: "applyGenreAnchors",
      });
    }
  }

  if (step === 2) {
    if (!rhythms.length) missing.push("Add at least one rhythm chip.");
    if (!sounds.length) missing.push("Add at least one sound module.");
    if ((!rhythms.length || !sounds.length) && genres.length) {
      improvements.push({
        id: "genre-anchors",
        title: "Apply genre groove anchors",
        description: "Auto-add rhythm and sound chips that match your selected genres.",
        action: "applyGenreAnchors",
      });
    }
  }

  if (step === 3) {
    if (!vocal) missing.push("Confirm vocal role (lead, instrumental, etc.).");
    if (
      vocal === "Instrumental" &&
      !hasInstrumentalSafetyRule(rules, snapshot.instrumentalVocalFx)
    ) {
      missing.push("Add an explicit no-vocal rule for instrumental tracks.");
      improvements.push({
        id: "instrumental-rule",
        title: "Add instrumental safety rule",
        description: "Prevents Suno from adding unwanted vocal textures in breaks.",
        action: "fixSunoWarnings",
      });
    }
    if (!rules) {
      improvements.push({
        id: "rules-starter",
        title: "Add starter production rules",
        description: "Short, Suno-safe rules for cleaner output.",
        action: "fixSunoWarnings",
      });
    }
  }

  if (step === 4) {
    if (idea.length < 10) missing.push("Write a clear creative goal (10+ characters).");
    if (structure.length < 8) missing.push("Add a section map (intro → verse → chorus…).");
    if (idea.length < 10 || structure.length < 8) {
      improvements.push({
        id: "idea-structure",
        title: "Fill idea + song form",
        description: "Use proven defaults you can edit after.",
        action: "fixSunoWarnings",
      });
    }
  }

  if (step === 5) {
    if (!lyricTheme && !lyricStyle) missing.push("Set lyric theme or lyric style.");
    if (vocal !== "Instrumental" && !generatedLyrics) {
      missing.push("Generate or paste lyric draft for Suno.");
      improvements.push({
        id: "generate-lyrics",
        title: "Generate lyric draft",
        description: "Build bracketed lyrics matched to your theme and style.",
        action: "generateExampleLyrics",
      });
    }
  }

  if (step === 6) {
    if (sunoWarnings.length) {
      improvements.push({
        id: "fix-warnings",
        title: "Fix Suno validator warnings",
        description: `${sunoWarnings.length} issue(s) found — one click to clean up.`,
        action: "fixSunoWarnings",
      });
    }
  }

  if (step === 7) {
    if (sunoWarnings.length) {
      missing.push("Resolve Suno validator warnings before copying.");
      improvements.push({
        id: "fix-warnings-final",
        title: "Auto-fix before copy",
        description: "Clean Style/Lyrics constraints so paste is Suno-safe.",
        action: "fixSunoWarnings",
      });
    }
  }

  const complete = missing.length === 0;

  return {
    step,
    stepName: cur.name,
    complete,
    missing,
    improvements,
    nextStepName: next?.name ?? null,
  };
}

/**
 * Stable key so the coach does not re-open for the same step outcome.
 * @param {ReturnType<typeof evaluateGuidedStepCoach>} report
 */
export function guidedCoachFingerprint(report) {
  const imp = report.improvements.map((x) => x.id).sort().join(",");
  const miss = report.missing.join("|");
  return `${report.step}:${report.complete ? 1 : 0}:${miss}:${imp}`;
}
