export function uniq(arr) {
  return Array.from(new Set(arr));
}

export function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function getIntensityText(promptIntensity) {
  if (promptIntensity < 30) return "strict and clean, low risk, avoid experimental drift";
  if (promptIntensity < 65) return "balanced creativity, controlled variation, clear identity";
  return "experimental, high-impact, more mutation, bold transitions, intense sound design";
}

export function getVocalText(vocal) {
  if (vocal === "Instrumental") return "instrumental only, no vocals, no vocal chops, no mumbled speech textures, do not use lyrics as FX";
  if (vocal === "Robotic") return "robotic voice persona, synthetic tone, processed delivery, rhythmic phrases, consistent voice identity";
  if (vocal === "Vocal Chops") return "short rhythmic vocal chops only, no lead singing, no mumbled background speech";
  if (vocal === "Choir") return "choir textures, cinematic vocal layers, no pop lead vocal";
  return `${vocal}, clear delivery, consistent vocal role, genre-matched processing`;
}

function bracketizeSunoPromptBlock(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
      return `[${trimmed}]`;
    })
    .join("\n");
}

export function buildLyricPrompt({
  vocal,
  lyricDensity,
  lyricLanguage,
  lyricTheme,
  lyricStyle,
  lyricMode,
  lyricStructure,
  selectedGenres,
  moodWords,
}) {
  if (vocal === "Instrumental") {
    return "[Lyrics: instrumental only, no sung lyrics, no rap, no spoken words.]";
  }

  const densityText = lyricDensity < 35
    ? "short sparse lines, few words, lots of space"
    : lyricDensity < 70
    ? "balanced lines, memorable phrases, clear hook"
    : "dense lyrical flow, internal rhyme, high detail";

  const styleMap = {
    "Dark poetic": "shadowy imagery, metaphor, night city atmosphere, serious tone",
    "Club chant": "short repeatable phrases, crowd energy, hook-first writing, simple words",
    "Street raw": "direct language, gritty confidence, grounded emotion, strong rhythm",
    "Emotional cinematic": "dramatic imagery, rising emotion, wide atmosphere, story feeling",
    "Minimal mantra": "few words repeated with hypnotic variation, simple and iconic",
    "Robotic cyber": "synthetic phrasing, digital metaphors, machine-like repetition",
    "Aggressive hype": "commanding lines, high pressure, bold hooks, performance energy",
    "Dreamlike abstract": "surreal images, strange symbols, floating emotion, loose logic",
  };

  const modeRules = {
    "Raw Prompt": "Create lyric direction only. Do not write full lyrics unless asked.",
    "Structured Song":
      "Write singable lyrics using bracket tags: [Intro], [Verse 1], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Final Chorus], [Outro].",
    "Performance Ready":
      "Write performance-ready lyrics with [Section] tags (Title Case inside brackets), short singable lines, repeatable chorus, ad-libs in parentheses.",
  };

  const sunoLyricTechniques = `SUNO LYRIC FIELD optional patterns (community workflows):
Section tags use Title Case inside brackets: [Intro], [Verse 1], [Chorus], [Build], [Drop], [Outro].
Scene in one line: [Intro: crowd ambience, applause, distant chant, stage reverb].
Crowd and stage cues: {crowd cheering}, {big applause}, {chanting fades}.
Choir tags: [Chorus — SATB layers] or [Chorus — massive harmonies].
Duets: [Female lead:] / [Male lead:] lines or named roles [Jane] / [John].
Energy map: [Build] then [Drop]; hooks can use ALL CAPS; screams and shouts stay short.
Alternate spoken and instruments: [Spoken] vs [Instrumental Break — sax].
FX ad-libs: (BOOM) (CLAP); fictional words stay very short.`;

  return bracketizeSunoPromptBlock(`LYRIC STYLE
Language: ${lyricLanguage}
Theme: ${lyricTheme}
Style: ${lyricStyle} — ${styleMap[lyricStyle] || lyricStyle}
Mode: ${lyricMode}
Structure: ${lyricStructure}
Density: ${densityText}
SUNO LANGUAGE RULES ONLY
Use bracket section tags like [Intro], [Verse 1], [Chorus], [Bridge], [Final Chorus], [Outro].
Keep lyric lines short and singable.
Do not write paragraphs.
Do not explain lyrics inside the lyric output.
Chorus or hook must be repeatable and easy to remember.
Match ${selectedGenres.join(" + ") || "the genre"} and ${moodWords} mood.
${modeRules[lyricMode]}
${sunoLyricTechniques}`);
}
