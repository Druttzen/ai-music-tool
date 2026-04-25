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
    return "Lyrics: instrumental only, no sung lyrics, no rap, no spoken words.";
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
    "Structured Song": "Write singable lyrics using [INTRO], [VERSE 1], [PRE-CHORUS], [CHORUS], [VERSE 2], [BRIDGE], [FINAL CHORUS], [OUTRO].",
    "Performance Ready": "Write final performance-ready lyrics. Use [SECTION] tags, short singable lines, repeated chorus, adlibs in parentheses, and no long prose.",
  };

  return `LYRIC STYLE:
Language: ${lyricLanguage}
Theme: ${lyricTheme}
Style: ${lyricStyle} — ${styleMap[lyricStyle] || lyricStyle}
Mode: ${lyricMode}
Structure: ${lyricStructure}
Density: ${densityText}

CRITICAL FORMAT RULES:
- Use bracket section tags exactly like [VERSE], [CHORUS], [BRIDGE], [OUTRO].
- Keep lyric lines short and singable.
- Do not write paragraphs.
- Do not explain the lyrics inside the lyric output.
- Chorus/hook must be repeatable and easy to remember.
- Match ${selectedGenres.join(" + ") || "the genre"} and ${moodWords} mood.
- ${modeRules[lyricMode]}`;
}
