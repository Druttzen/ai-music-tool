import { getLyricStyleDirection } from "./lyric-generator";
import { getSunoLanguagePromptRules } from "./suno-lyric-languages";

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
  if (!vocal) return "vocal role not selected yet — pick a vocal mode when you reach that step";
  if (vocal === "Instrumental") return "instrumental only, no vocals, no vocal chops, no mumbled speech textures, do not use lyrics as FX";
  if (vocal === "Robotic") return "robotic voice persona, synthetic tone, processed delivery, rhythmic phrases, consistent voice identity";
  if (vocal === "Vocal Chops") return "short rhythmic vocal chops only, no lead singing, no mumbled background speech";
  if (vocal === "Choir") return "choir textures, cinematic vocal layers, no pop lead vocal";
  return `${vocal}, clear delivery, consistent vocal role, genre-matched processing`;
}

/**
 * Wrap one line for Suno metadata fields.
 * Lines that already contain inner [Section] examples use [Meta: ...] to avoid nested tags.
 */
export function bracketizeSunoPromptLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return "";

  const isSimpleTag =
    trimmed.startsWith("[") &&
    trimmed.endsWith("]") &&
    !trimmed.slice(1, -1).includes("[");

  if (isSimpleTag) return trimmed;

  if (/\[[^\]]+\]/.test(trimmed)) {
    return `[Meta: ${trimmed}]`;
  }

  return `[${trimmed}]`;
}

export function bracketizeSunoPromptBlock(text) {
  return String(text || "")
    .split("\n")
    .map((line) => bracketizeSunoPromptLine(line))
    .filter(Boolean)
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

  const languageRules = getSunoLanguagePromptRules(lyricLanguage);

  return bracketizeSunoPromptBlock(`LYRIC STYLE
Language: ${lyricLanguage}
Theme: ${lyricTheme}
Style: ${lyricStyle} — ${getLyricStyleDirection(lyricStyle)}
Mode: ${lyricMode}
Structure: ${lyricStructure}
Density: ${densityText}
${languageRules}
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
