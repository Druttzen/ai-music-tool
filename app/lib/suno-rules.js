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
}) {
  const styleLine = `${selectedGenres.join(" + ") || "Electronic"} | ${tempo} | ${moodWords}`;
  const productionLine = `Sound design: ${selectedSounds.slice(0, 8).join(", ") || "balanced instruments"} | Rhythm: ${selectedRhythms.join(", ") || "steady groove"}`;
  const vocalLine = `Vocal intent: ${vocalText}`;
  const structureLine = `Song form: ${structure}`;
  const negatives = [];
  if (vocal === "Instrumental") negatives.push("no vocals", "no vocal chops", "no mumbled speech");
  if (rules.toLowerCase().includes("no")) negatives.push("follow explicit negative constraints in Rules");

  return `STYLE DNA:
${styleLine}

PRODUCTION TOKENS:
${productionLine}

${vocalLine}
${structureLine}
Creative goal: ${idea}

LYRIC DIRECTION:
${vocal !== "Instrumental" ? lyricPrompt : "Instrumental only. No lyrical content."}

NEGATIVE CONSTRAINTS:
${negatives.length ? negatives.join(", ") : "avoid off-genre drift and muddy mix decisions"}

RULES:
${rules}
Energy arc: ${intensityText}
Generation mode: ${mode}`;
}

export function validateSunoLikePrompt({ selectedGenres, selectedSounds, selectedRhythms, vocal, rules, structure, idea }) {
  const warnings = [];
  if (!selectedGenres.length) warnings.push("Add at least one genre in Style DNA.");
  if (!selectedSounds.length) warnings.push("Add at least one production token in Sound modules.");
  if (!selectedRhythms.length) warnings.push("Define at least one rhythm anchor.");
  if (!structure || structure.trim().length < 8) warnings.push("Song form is too short; add section flow.");
  if (!idea || idea.trim().length < 10) warnings.push("Creative goal is too short; add more intent.");
  if (vocal === "Instrumental" && !rules.toLowerCase().includes("no vocal")) warnings.push("Instrumental mode should include explicit no-vocal rule.");
  if (selectedGenres.length > 3) warnings.push("Too many genres may cause style drift; prefer 1-2 core genres.");
  return warnings;
}
