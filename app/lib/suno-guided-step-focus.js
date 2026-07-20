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
  suiteAddons: "suiteAddons",
  mode: "mode",
  proModeLeft: "proModeLeft",
  promptPreview: "promptPreview",
  sunoValidator: "sunoValidator",
  sunoLanguageIndex: "sunoLanguageIndex",
  history: "history",
  trackScoring: "trackScoring",
};

const ALWAYS_VISIBLE = new Set([
  GUIDED_PANEL_IDS.guidedPath,
  GUIDED_PANEL_IDS.maestro,
  GUIDED_PANEL_IDS.saveLoad,
  GUIDED_PANEL_IDS.suiteAddons,
]);

/** Suno Voice Style line or compact block counts as voice-style ready for polish-step coach. */
export function hasVoiceStyleForCoach(snapshot = {}) {
  return !!String(snapshot.voiceStyleCompact?.style || snapshot.voiceStyleLine || "").trim();
}

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
      GUIDED_PANEL_IDS.vocalEmbed,
      GUIDED_PANEL_IDS.analyzers,
      GUIDED_PANEL_IDS.styleDna,
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
    const hasTrack = !!snapshot.audioAnalysis?.fileName;
    const hasVoiceStyle = hasVoiceStyleForCoach(snapshot);
    const instrumental = vocal === "Instrumental";

    if (!hasTrack) {
      missing.push("Analyze an instrumental track in Drag & Drop Analyzers for Vocal Embed Studio.");
      improvements.push({
        id: "open-analyzers",
        title: "Open track analyzer",
        description: "Upload your instrumental so section timing and mix ducking can be planned.",
        action: "showAnalyzers",
      });
    }

    if (!instrumental && !hasVoiceStyle) {
      missing.push("Load Voice Character traits for local vocal style conversion.");
      improvements.push({
        id: "voice-character",
        title: "Analyze a voice character",
        description: "Use Voice Character Studio or a preset so the sidecar knows your target style.",
        action: "showAnalyzers",
      });
    }

    if (!instrumental && !generatedLyrics && hasTrack) {
      missing.push("Add lyric draft for Vocal Embed section timing.");
      improvements.push({
        id: "vocal-embed-lyrics",
        title: "Generate lyrics for placement map",
        description: "Bracketed lyrics drive section timing in Vocal Embed Studio.",
        action: "generateExampleLyrics",
      });
    }

    if (hasTrack && hasVoiceStyle && (instrumental || generatedLyrics)) {
      improvements.push({
        id: "vocal-embed-align-synth",
        title: "Align & synthesize vocal preview",
        description:
          "Attach a guide vocal in Vocal Embed Studio, then run Align & synthesize for a local WAV with timing.",
        action: "focusVocalEmbed",
      });
      improvements.push({
        id: "vocal-embed-align-handoff",
        title: "Align & export handoff pack",
        description:
          "Export plan JSON, audio, and align-preview.json in one step for external DiffSinger/RVC workflows.",
        action: "focusVocalEmbed",
      });
      improvements.push({
        id: "vocal-embed-preview",
        title: "Try Vocal Embed preview mix",
        description: "Open Vocal Embed Studio, attach a guide vocal if needed, and synthesize a local WAV.",
        action: "focusVocalEmbed",
      });
    }

    if (hasTrack && snapshot.audioAnalysis?.sourceEngine === "musicgen") {
      improvements.push({
        id: "maestro-musicgen",
        title: "Ask Maestro about the MusicGen sketch",
        description: "Regenerate with melody or copy the MG prompt line into your Suno style.",
        action: "focusMaestro",
        maestroPrompt: "Regenerate with melody",
      });
    }

    if (
      snapshot.coProducerLlmReady &&
      hasTrack &&
      hasVoiceStyle &&
      !instrumental &&
      generatedLyrics
    ) {
      improvements.push({
        id: "maestro-vocal-handoff",
        title: "Ask Maestro to export vocal handoff",
        description:
          "Prefills Maestro with align + handoff export — scrolls to chat and Vocal Embed when you send.",
        action: "focusMaestro",
        maestroPrompt: "align and export handoff",
      });
      improvements.push({
        id: "maestro-openvpi-ds",
        title: "Ask Maestro about OpenVPI .ds",
        description:
          "Prefills Maestro with show openvpi ds — returns the vocal embed brief and segment status.",
        action: "focusMaestro",
        maestroPrompt: "show openvpi ds",
      });
    }

    if (hasTrack && hasVoiceStyle && !instrumental && generatedLyrics) {
      improvements.push({
        id: "openvpi-ds-export",
        title: "Export OpenVPI .ds for DiffSinger",
        description: "Download segment JSON from Vocal Embed Studio for external OpenVPI inference.",
        action: "focusVocalEmbed",
      });
    }

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
