/**
 * Co-Producer lyric & hook generation — style-aware drafts tied to Lyric Style prompts.
 */

import { bracketizeSunoPromptBlock, bracketizeSunoPromptLine } from "./music-helpers";
import {
  applyLanguageFlavorToContent,
  formatSunoLyricSectionTag,
  getLanguageEnergyLine,
  getLanguageHeaderLine,
  getLanguageHookLine,
  getSunoLanguagePromptRules,
} from "./suno-lyric-languages";
import {
  SUNO_LYRICS_CHAR_TYPICAL_MAX,
  SUNO_LYRICS_CHAR_WARN,
} from "./suno-limits";

/** Suno direction text for each Lyric Style preset (shared with buildLyricPrompt). */
export const LYRIC_STYLE_DIRECTIONS = {
  "Dark poetic":
    "shadowy imagery, metaphor, night city atmosphere, serious tone",
  "Club chant":
    "short repeatable phrases, crowd energy, hook-first writing, simple words",
  "Street raw":
    "direct language, gritty confidence, grounded emotion, strong rhythm",
  "Emotional cinematic":
    "dramatic imagery, rising emotion, wide atmosphere, story feeling",
  "Minimal mantra":
    "few words repeated with hypnotic variation, simple and iconic",
  "Robotic cyber":
    "synthetic phrasing, digital metaphors, machine-like repetition",
  "Aggressive hype":
    "commanding lines, high pressure, bold hooks, performance energy",
  "Dreamlike abstract":
    "surreal images, strange symbols, floating emotion, loose logic",
};

/**
 * Resolve voice character context for Co-Producer lyrics/hooks (character studio session or Style line).
 * @param {object} input
 */
export function resolveVoiceLyricContext(input) {
  const compact =
    input?.voiceStyleCompact && typeof input.voiceStyleCompact === "object"
      ? input.voiceStyleCompact
      : { style: "", lyricTag: "" };
  const vocalTag = String(compact.lyricTag || "").trim();
  const deliveryHint = String(compact.style || "").trim() || String(input?.voiceStyleLine || "").trim().slice(0, 160);
  const vocalRole =
    input?.vocal && input.vocal !== "Instrumental" ? String(input.vocal).trim() : "";
  return { vocalTag, deliveryHint, vocalRole };
}

/**
 * @param {string} lyrics
 * @param {{ vocalTag: string, deliveryHint: string, vocalRole: string }} voiceCtx
 */
export function prependVoiceCharacterToLyrics(lyrics, voiceCtx) {
  const body = String(lyrics || "").trim();
  if (!body) return body;
  const blocks = [];
  if (voiceCtx.vocalTag) {
    blocks.push(voiceCtx.vocalTag);
  } else if (voiceCtx.deliveryHint) {
    blocks.push(`[Vocal character: ${voiceCtx.deliveryHint}]`);
  }
  if (voiceCtx.vocalRole) {
    blocks.push(`[Vocal role: ${voiceCtx.vocalRole}]`);
  }
  if (!blocks.length) return body;
  return `${blocks.join("\n")}\n\n${body}`;
}

const LYRIC_STYLE_CONTENT = {
  "Dark poetic": {
    signatureLine: "Shadows move under my skin",
    verse: [
      "Neon rain on empty streets",
      "Every secret that I keep",
      "Moonlight cuts through concrete grey",
      "Words I never meant to say",
    ],
    chorus: [
      "In the dark we come alive",
      "Every ghost learns how to thrive",
      "Hold the night inside your chest",
      "Let the silence do the rest",
    ],
    bridge: ["Strip the light", "Face the void", "One truth left", "Unemployed of noise"],
    hooks: [
      "In the dark we come alive",
      "Neon secrets, stay alive",
      "Shadows know my name tonight",
    ],
    introCue: "low fog, distant reverb, whispered tone",
  },
  "Club chant": {
    signatureLine: "Hands up, bass down, move now",
    verse: [
      "One, two, drop — we don't stop",
      "Feel the floor, feel the top",
      "Every voice becomes the beat",
      "Move your feet, move your feet",
    ],
    chorus: [
      "Hands up! Bass down! Move now!",
      "We don't stop — take a bow!",
      "Louder! Louder! Feel the sound!",
      "Whole room shaking off the ground!",
    ],
    bridge: ["Break it down", "Clap it back", "Build it up", "Attack the track"],
    hooks: ["Hands up! Bass down!", "We don't stop!", "Feel the drop!"],
    introCue: "crowd noise, DJ count-in, sub swell",
  },
  "Street raw": {
    signatureLine: "Built from grit, I stand my ground",
    verse: [
      "Concrete truth in every bar",
      "Scars that show who you are",
      "No fake shine, no borrowed crown",
      "Real talk when the lights go down",
    ],
    chorus: [
      "I don't fold, I don't break",
      "Every step is mine to take",
      "Pressure makes the steel ignite",
      "I was born for this fight",
    ],
    bridge: ["Strip the mask", "Say it plain", "Own the pain", "Start again"],
    hooks: ["Stand my ground", "Real talk, real sound", "Born for this fight"],
    introCue: "dry vocal, tight room, confident delivery",
  },
  "Emotional cinematic": {
    signatureLine: "Hearts collide beneath the sky",
    verse: [
      "Wide horizon, fading sun",
      "Two souls becoming one",
      "Every frame holds breath and time",
      "Love and loss in every line",
    ],
    chorus: [
      "Rise with me through fire and rain",
      "Feel the thunder, feel the pain",
      "Every ending starts anew",
      "I still find my way to you",
    ],
    bridge: ["Hold the silence", "Let it swell", "Break the dam", "Fare thee well"],
    hooks: ["Hearts collide beneath the sky", "Rise with me through rain", "Find my way to you"],
    introCue: "orchestral swell, wide reverb, intimate vocal",
  },
  "Minimal mantra": {
    signatureLine: "One pulse, one breath, one flame",
    verse: ["One pulse", "One breath", "One flame", "Same name"],
    chorus: [
      "One pulse, one breath, one flame",
      "One pulse, one breath, one flame",
      "One pulse, one breath, one flame",
      "Never change the sacred name",
    ],
    bridge: ["One", "One", "One", "Done"],
    hooks: ["One pulse", "One breath", "One flame"],
    introCue: "hypnotic loop, sparse vocal, meditative space",
  },
  "Robotic cyber": {
    signatureLine: "Metal heart, electric mind",
    verse: [
      "Binary blood in chrome veins",
      "Signal loss through data chains",
      "Neon code replaces skin",
      "Machine awake within",
    ],
    chorus: [
      "Metal heart, electric mind",
      "Leave the flesh and code behind",
      "Upload soul to static light",
      "We evolve into the night",
    ],
    bridge: ["System fail", "Reboot core", "Sync complete", "Ask for more"],
    hooks: ["Metal heart", "Electric mind", "Upload soul tonight"],
    introCue: "glitch vocal, synthetic filter, digital noise bed",
  },
  "Aggressive hype": {
    signatureLine: "Break the floor, shake the walls",
    verse: [
      "No retreat, no slow lane",
      "Turn the pressure into pain",
      "Every bar a warning shot",
      "Give me everything you got",
    ],
    chorus: [
      "Break the floor! Shake the walls!",
      "No surrender when it falls!",
      "Louder! Harder! Take the crown!",
      "Burn the whole thing down!",
    ],
    bridge: ["Drop the beat", "Scream it raw", "No law", "No flaw"],
    hooks: ["Break the floor!", "Shake the walls!", "Take the crown!"],
    introCue: "hype vocal, distorted energy, stadium pressure",
  },
  "Dreamlike abstract": {
    signatureLine: "Silver shadows melt in rain",
    verse: [
      "Glass moons drift through violet air",
      "Clocks dissolve without a care",
      "Feathers fall from static skies",
      "Truth wears someone else's eyes",
    ],
    chorus: [
      "Silver shadows melt in rain",
      "Nothing lost and nothing gained",
      "Float between the waking dream",
      "Nothing is the way it seems",
    ],
    bridge: ["Dissolve", "Reform", "Forget", "Transform"],
    hooks: ["Silver shadows melt", "Waking dream", "Nothing as it seems"],
    introCue: "ethereal wash, floating vocal, surreal space",
  },
};

function moodEnergyLine(mood, lyricLanguage) {
  if (mood.energy > 70) return getLanguageEnergyLine(lyricLanguage, "high");
  if (mood.energy < 35) return getLanguageEnergyLine(lyricLanguage, "low");
  return getLanguageEnergyLine(lyricLanguage, "mid");
}

function moodHookLine(mood, lyricLanguage) {
  if (mood.darkness > 65) return getLanguageHookLine(lyricLanguage, "dark");
  if (mood.emotion > 65) return getLanguageHookLine(lyricLanguage, "emo");
  return getLanguageHookLine(lyricLanguage, "light");
}

export function getLyricStyleDirection(lyricStyle) {
  return LYRIC_STYLE_DIRECTIONS[lyricStyle] || String(lyricStyle || "").trim();
}

export function formatLyricsCharBudget(text) {
  const len = String(text || "").length;
  return {
    len,
    max: SUNO_LYRICS_CHAR_TYPICAL_MAX,
    warnAt: SUNO_LYRICS_CHAR_WARN,
    label: `${len}/${SUNO_LYRICS_CHAR_TYPICAL_MAX}`,
    isWarn: len > SUNO_LYRICS_CHAR_WARN,
    isOver: len > SUNO_LYRICS_CHAR_TYPICAL_MAX,
  };
}

function computeSeed(mood, variantSeed = 0) {
  return Math.floor(
    (Number(mood?.energy) || 50) +
      (Number(mood?.darkness) || 50) +
      (Number(mood?.emotion) || 50) +
      (Number(variantSeed) || 0) * 17,
  );
}

function pickLines(pool, seed, count = 2) {
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    lines.push(pool[(seed + i) % pool.length]);
  }
  return lines;
}

function densityLineCount(lyricDensity) {
  const d = Number(lyricDensity) || 55;
  if (d < 35) return 1;
  if (d < 70) return 2;
  return 3;
}

function buildStructuredLyrics({
  content,
  styleLabel,
  styleDirection,
  theme,
  lyricMode,
  lyricLanguage,
  mood,
  seed,
  lineCount,
}) {
  const verseLines = pickLines(content.verse, seed, lineCount);
  const chorusLines = pickLines(content.chorus, seed + 1, Math.min(lineCount + 1, 3));
  const bridgeLines = pickLines(content.bridge, seed + 2, lineCount);
  const verse2Lines = pickLines(content.verse, seed + 3, lineCount);
  const energyLine = moodEnergyLine(mood || {}, lyricLanguage);
  const hookLine = moodHookLine(mood || {}, lyricLanguage);
  const styleTag = `[Style: ${styleLabel} — ${styleDirection}]`;
  const langHeader = getLanguageHeaderLine(lyricLanguage);
  const tag = (name) => formatSunoLyricSectionTag(name, lyricLanguage);
  const densityNote =
    lineCount === 1 ? "(sparse — leave space between lines)" : lineCount >= 3 ? "(dense — rapid phrases)" : "";

  if (lyricMode === "Performance Ready") {
    return `${tag("Intro")}
(${content.introCue})

${styleTag}
${langHeader ? `${langHeader}\n` : ""}
${tag("Verse 1")}
${theme}
${content.signatureLine}
${verseLines.join("\n")}

${tag("Pre-Chorus")}
${energyLine}
Take control, don't slow it down
Feel the signal underground
We are rising through the sound

${tag("Chorus")}
${hookLine}
${chorusLines.join("\n")}
${content.signatureLine}

${tag("Verse 2")}
Same fire, new direction
Built from pressure and connection
${verse2Lines.join("\n")}

${tag("Bridge")}
${bridgeLines.join("\n")}
Hold the silence
Shape the wave

${tag("Final Chorus")}
${hookLine}
${chorusLines.join("\n")}
${content.signatureLine}

${tag("Outro")}
(fading vocal echo)
${content.signatureLine}
${densityNote}`.trim();
  }

  return `${tag("Intro")}
(${content.introCue})

${styleTag}
${langHeader ? `${langHeader}\n` : ""}
${tag("Verse 1")}
${theme}
${content.signatureLine}
${verseLines.join("\n")}

${tag("Pre-Chorus")}
${energyLine}
Take control, don't slow it down

${tag("Chorus")}
${hookLine}
${chorusLines.join("\n")}

${tag("Verse 2")}
Same rhythm, new direction
Built on sound and tension
${verse2Lines.join("\n")}

${tag("Bridge")}
${bridgeLines.join("\n")}

${tag("Chorus")}
${hookLine}
${chorusLines.join("\n")}

${tag("Outro")}
(fading energy, minimal vocal tail)
${content.signatureLine}
${densityNote}`.trim();
}

/**
 * @param {object} input
 * @param {number} [input.variantSeed]
 * @param {number} [input.lyricDensity]
 * @returns {{ lyrics: string, styleLabel: string, styleDirection: string, variantSeed: number }}
 */
export function generateCoProducerLyrics(input) {
  const {
    vocal,
    lyricStyle,
    lyricTheme,
    lyricMode,
    lyricLanguage,
    lyricStructure,
    lyricDensity,
    mood,
    moodWords,
    selectedGenres,
    idea = "",
    variantSeed = 0,
  } = input;

  const styleLabel = lyricStyle || "Dark poetic";
  const styleDirection = getLyricStyleDirection(styleLabel);
  const baseContent = LYRIC_STYLE_CONTENT[styleLabel] || LYRIC_STYLE_CONTENT["Dark poetic"];
  const content = applyLanguageFlavorToContent(baseContent, lyricLanguage);
  const theme = String(lyricTheme || idea || "the night").trim();
  const seed = computeSeed(mood, variantSeed);
  const lineCount = densityLineCount(lyricDensity);

  if (vocal === "Instrumental") {
    return {
      lyrics: bracketizeSunoPromptLine(
        "Instrumental mode is active. Switch vocal mode to generate lyrics.",
      ),
      styleLabel,
      styleDirection,
      variantSeed,
    };
  }

  if (lyricMode === "Raw Prompt") {
    const densityText =
      lineCount === 1
        ? "short sparse lines, few words, lots of space"
        : lineCount >= 3
          ? "dense lyrical flow, internal rhyme, high detail"
          : "balanced lines, memorable phrases, clear hook";
    const langRules = getSunoLanguagePromptRules(lyricLanguage);
    const voiceCtx = resolveVoiceLyricContext(input);
    return {
      lyrics: prependVoiceCharacterToLyrics(
        bracketizeSunoPromptBlock(`LYRIC DIRECTION · ${styleLabel}
Language: ${lyricLanguage}
Theme: ${theme}
Style: ${styleLabel} — ${styleDirection}
Structure: ${lyricStructure}
Mood: ${moodWords}
Density: ${densityText}
Signature hook example: ${content.signatureLine}
Write short singable lines with a strong repeated chorus.
Use [Verse], [Chorus], [Bridge], and [Outro] tags.
${langRules}
Match ${selectedGenres.join(" + ") || "the genre"} and ${styleDirection}.`),
        voiceCtx,
      ),
      styleLabel,
      styleDirection,
      variantSeed,
    };
  }

  const voiceCtx = resolveVoiceLyricContext(input);
  return {
    lyrics: prependVoiceCharacterToLyrics(
      buildStructuredLyrics({
        content,
        styleLabel,
        styleDirection,
        theme,
        lyricMode,
        lyricLanguage,
        mood,
        seed,
        lineCount,
      }),
      voiceCtx,
    ),
    styleLabel,
    styleDirection,
    variantSeed,
  };
}

/**
 * Style-aware hook sketches for the Co-Producer panel.
 * @param {object} input
 * @returns {{ hooks: string, styleLabel: string, styleDirection: string }}
 */
export function generateCoProducerHooks(input) {
  const {
    vocal,
    lyricStyle,
    lyricTheme,
    lyricLanguage,
    mood,
    idea = "",
    variantSeed = 0,
  } = input;

  const styleLabel = lyricStyle || "Dark poetic";
  const styleDirection = getLyricStyleDirection(styleLabel);
  const baseContent = LYRIC_STYLE_CONTENT[styleLabel] || LYRIC_STYLE_CONTENT["Dark poetic"];
  const content = applyLanguageFlavorToContent(baseContent, lyricLanguage);
  const core = String(lyricTheme || idea || "the night").trim();
  const seed = computeSeed(mood, variantSeed);
  const hookPool = content.hooks || [content.signatureLine];
  const h1 = hookPool[seed % hookPool.length];
  const h2 = hookPool[(seed + 1) % hookPool.length];
  const h3 = hookPool[(seed + 2) % hookPool.length];
  const hookAccent = moodHookLine(mood || {}, lyricLanguage);
  const energyAccent = moodEnergyLine(mood || {}, lyricLanguage);

  if (vocal === "Instrumental") {
    return {
      hooks: bracketizeSunoPromptLine(
        "Instrumental mode is active. Switch vocal mode to generate lyric hooks.",
      ),
      styleLabel,
      styleDirection,
    };
  }

  const hooks = `${bracketizeSunoPromptLine(`HOOK IDEAS · ${styleLabel}`)}
${bracketizeSunoPromptLine(`Style: ${styleDirection}`)}
${bracketizeSunoPromptLine("Meta: Example hook sketches — singable lines for the Lyrics field.")}

1.
${core}
${h1}
${hookAccent}

2.
${h2}
${energyAccent}

3.
${h3}
${content.signatureLine}`;

  const voiceCtx = resolveVoiceLyricContext(input);
  return {
    hooks: prependVoiceCharacterToLyrics(hooks, voiceCtx),
    styleLabel,
    styleDirection,
  };
}

/**
 * Merge timed instrumental scaffold with Co-Producer style lyrics.
 * @param {string} scaffold
 * @param {{ lyrics: string, styleLabel: string, styleDirection: string }} coProducer
 */
export function mergeInstrumentalScaffoldWithStyleLyrics(scaffold, coProducer) {
  const body = String(coProducer.lyrics || "").trim();
  if (!body) return scaffold;
  return `${String(scaffold || "").trim()}

--- Co-Producer singable draft (${coProducer.styleLabel} — ${coProducer.styleDirection}) ---
Edit lines to match the timed sections above.

${body}`;
}
