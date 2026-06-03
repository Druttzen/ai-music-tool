import { validateSunoFieldLengths } from "./suno-limits";

/**
 * Text for Suno **Style of Music** (sound, arrangement intent, rules) — no lyric-generation block.
 */
export function buildSunoStyleBoxPrompt({
  selectedGenres,
  tempo,
  moodWords,
  selectedSounds,
  selectedRhythms,
  vocalText,
  structure,
  idea,
  vocal,
  rules,
  intensityText,
  mode,
  voiceStyleReference = "",
}) {
  const styleLine = `${selectedGenres.join(" + ") || "Electronic"} | ${tempo} | ${moodWords}`;
  const productionLine = `${selectedSounds.slice(0, 8).join(", ") || "balanced instruments"} | ${selectedRhythms.join(", ") || "steady groove"}`;
  const vocalLine = `VOC:\n${vocalText}`;
  const voiceRefSection =
    voiceStyleReference.trim() && vocal !== "Instrumental"
      ? `VREF:\n${voiceStyleReference.trim()}\n\n`
      : "";
  const negatives = [];
  if (vocal === "Instrumental") negatives.push("no vocals", "no vocal chops", "no mumbled speech");
  if (rules.toLowerCase().includes("no")) negatives.push("follow explicit negative constraints in Rules");

  /** Short section tags — saves characters for RULES (analyzers, negatives) under Suno Style cap. */
  return `DNA:
${styleLine}

SND:
${productionLine}

${vocalLine}

${voiceRefSection}FORM:
${structure}
GOAL:
${idea}

NO-GO:
${negatives.length ? negatives.join(", ") : "avoid off-genre drift and muddy mix decisions"}

RULES:
${rules}
ARC:
${intensityText}
MODE:
${mode}`;
}

/** Text for Suno **Lyrics** field — structure / lyric direction only (no style DNA). */
export function buildSunoLyricsBoxPrompt({ vocal, lyricPrompt }) {
  if (vocal === "Instrumental") {
    return "Instrumental only. No lyrical content.";
  }
  const t = (lyricPrompt || "").trim();
  return t || "(Add lyric lines or bracketed sections.)";
}

export function buildSunoLikePrompt({
  selectedGenres,
  tempo,
  moodWords,
  selectedSounds,
  selectedRhythms,
  vocalText,
  structure,
  idea,
  lyricPrompt,
  vocal,
  rules,
  intensityText,
  mode,
  voiceStyleReference = "",
}) {
  const params = {
    selectedGenres,
    tempo,
    moodWords,
    selectedSounds,
    selectedRhythms,
    vocalText,
    structure,
    idea,
    vocal,
    rules,
    intensityText,
    mode,
    voiceStyleReference,
  };
  const styleBlock = buildSunoStyleBoxPrompt(params);
  const lyricBlock =
    vocal !== "Instrumental" ? lyricPrompt : "Instrumental only. No lyrical content.";
  return `${styleBlock}

LYRIC DIRECTION:
${lyricBlock}`;
}

/**
 * Structural checks + typical Suno field length warnings (model-dependent caps).
 */
export function validateSunoLikePrompt(params) {
  const {
    selectedGenres,
    selectedSounds,
    selectedRhythms,
    vocal,
    instrumentalVocalFx,
    rules,
    structure,
    idea,
    tempo,
    moodWords,
    vocalText,
    lyricPrompt,
    intensityText,
    mode,
    voiceStyleReference,
    lyricTheme,
    lyricLanguage,
    lyricStructure,
    lyricStyle,
    lyricDensity,
    lyricMode,
    generatedLyrics,
    pastedStyleLen,
    pastedLyricsLen,
  } = params;

  const warnings = [];
  if (!selectedGenres?.length) warnings.push("Add at least one genre in DNA (genres row).");
  if (!selectedSounds?.length) warnings.push("Add at least one production token in Sound modules.");
  if (!selectedRhythms?.length) warnings.push("Define at least one rhythm anchor.");
  if (!structure || structure.trim().length < 8) warnings.push("Song form is too short; add section flow.");
  if (!idea || idea.trim().length < 10) warnings.push("Creative goal is too short; add more intent.");
  if (
    vocal === "Instrumental" &&
    !instrumentalVocalFx &&
    !rules.toLowerCase().includes("no vocal")
  ) {
    warnings.push("Instrumental mode should include explicit no-vocal rule (or use Vocal FX for texture-only).");
  }
  if (selectedGenres.length > 3) {
    warnings.push("Too many genres may cause style drift; prefer 1-2 core genres.");
  }

  if (typeof pastedStyleLen === "number" && typeof pastedLyricsLen === "number") {
    warnings.push(...validateSunoFieldLengths(pastedStyleLen, pastedLyricsLen));
  } else {
    const full = {
      selectedGenres,
      tempo,
      moodWords,
      selectedSounds,
      selectedRhythms,
      vocalText,
      structure,
      idea,
      vocal,
      rules,
      intensityText,
      mode,
      voiceStyleReference: voiceStyleReference ?? "",
      lyricPrompt,
    };
    warnings.push(
      ...validateSunoFieldLengths(
        buildSunoStyleBoxPrompt(full).length,
        buildSunoLyricsBoxPrompt(full).length,
      ),
    );
  }

  return warnings;
}
