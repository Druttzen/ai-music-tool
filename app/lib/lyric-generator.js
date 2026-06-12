/**
 * Co-Producer lyric & hook generation — style-aware drafts tied to Lyric Style prompts.
 */

import { bracketizeSunoPromptBlock, bracketizeSunoPromptLine } from "./music-helpers";
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

/** Swedish phrase overlays per style (used when Language = Swedish or Mixed). */
const SWEDISH_STYLE_PHRASES = {
  "Dark poetic": {
    signatureLine: "Skuggor rör sig under huden",
    verse: ["Neons regn på tomma gator", "Månsken skär genom betonggrått"],
    chorus: ["I mörkret vaknar vi", "Håll natten i ditt bröst"],
    hooks: ["I mörkret vaknar vi", "Neonhemligheter"],
  },
  "Club chant": {
    signatureLine: "Händer upp, bas ner, rör dig nu",
    verse: ["Ett, två, drop — vi stannar inte", "Känn golvet, känn toppen"],
    chorus: ["Händer upp! Bas ner! Rör dig nu!", "Vi stannar inte!"],
    hooks: ["Händer upp!", "Känn droppen!"],
  },
  "Street raw": {
    signatureLine: "Byggd av grit, jag står min mark",
    verse: ["Betongsanning i varje bar", "Ärr som visar vem du är"],
    chorus: ["Jag viker mig inte", "Varje steg är mitt att ta"],
    hooks: ["Står min mark", "Äkta talk"],
  },
  "Emotional cinematic": {
    signatureLine: "Hjärtan möts under himlen",
    verse: ["Vid horisonten, sol som dör", "Två själar blir till en"],
    chorus: ["Res med mig genom eld och regn", "Jag finner vägen tillbaka"],
    hooks: ["Hjärtan möts", "Res med mig"],
  },
  "Minimal mantra": {
    signatureLine: "Ett pulsslag, ett andetag, en låga",
    verse: ["Ett pulsslag", "Ett andetag"],
    chorus: ["Ett pulsslag, ett andetag, en låga"],
    hooks: ["Ett pulsslag", "En låga"],
  },
  "Robotic cyber": {
    signatureLine: "Metallhjärta, elektriskt sinne",
    verse: ["Binär blod i kromådror", "Neon kod ersätter hud"],
    chorus: ["Metallhjärta, elektriskt sinne", "Ladda upp själen i ljus"],
    hooks: ["Metallhjärta", "Elektriskt sinne"],
  },
  "Aggressive hype": {
    signatureLine: "Krossa golvet, skaka väggarna",
    verse: ["Ingen reträtt, inget långsamt", "Varje bar en varningsskott"],
    chorus: ["Krossa golvet! Skaka väggarna!", "Ta kronan!"],
    hooks: ["Krossa golvet!", "Ta kronan!"],
  },
  "Dreamlike abstract": {
    signatureLine: "Silver skuggor smälter i regn",
    verse: ["Glasmånar driver i violett luft", "Klockor löses upp utan brådska"],
    chorus: ["Silver skuggor smälter i regn", "Inget är som det verkar"],
    hooks: ["Silver skuggor", "Drömmande tillstånd"],
  },
};

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

function applyLanguageFlavor(content, lyricStyle, lyricLanguage) {
  if (lyricLanguage === "English" || lyricLanguage === "No specific language") {
    return content;
  }
  const sv = SWEDISH_STYLE_PHRASES[lyricStyle];
  if (!sv) return content;

  if (lyricLanguage === "Swedish") {
    return {
      ...content,
      signatureLine: sv.signatureLine || content.signatureLine,
      verse: sv.verse?.length ? sv.verse : content.verse,
      chorus: sv.chorus?.length ? sv.chorus : content.chorus,
      hooks: sv.hooks?.length ? sv.hooks : content.hooks,
    };
  }

  if (lyricLanguage === "Mixed English/Swedish") {
    return {
      ...content,
      signatureLine: `${content.signatureLine} / ${sv.signatureLine || ""}`.trim(),
      verse: [...content.verse.slice(0, 2), ...(sv.verse || []).slice(0, 2)],
      chorus: [...content.chorus.slice(0, 2), ...(sv.chorus || []).slice(0, 2)],
      hooks: [...(content.hooks || []).slice(0, 2), ...(sv.hooks || []).slice(0, 1)],
    };
  }
  return content;
}

function moodEnergyLine(mood, lyricLanguage) {
  if (lyricLanguage === "Swedish") {
    if (mood.energy > 70) return "Känn trycket, känn ljudet";
    if (mood.energy < 35) return "Långsam rörelse, glider ner";
    return "Varje hjärtslag låser tiden";
  }
  if (mood.energy > 70) return "Feel the pressure, feel the sound";
  if (mood.energy < 35) return "Slow motion, drifting down";
  return "Every heartbeat locks in time";
}

function moodHookLine(mood, lyricLanguage) {
  if (lyricLanguage === "Swedish") {
    if (mood.darkness > 65) return "I mörkret vaknar vi";
    if (mood.emotion > 65) return "Hjärtan möts under himlen";
    return "I ljuset stiger vi igen";
  }
  if (mood.darkness > 65) return "In the dark we come alive";
  if (mood.emotion > 65) return "Hearts collide beneath the sky";
  return "In the light we rise again";
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
  const densityNote =
    lineCount === 1 ? "(sparse — leave space between lines)" : lineCount >= 3 ? "(dense — rapid phrases)" : "";

  if (lyricMode === "Performance Ready") {
    return `[Intro]
(${content.introCue})

${styleTag}

[Verse 1]
${theme}
${content.signatureLine}
${verseLines.join("\n")}

[Pre-Chorus]
${energyLine}
Take control, don't slow it down
Feel the signal underground
We are rising through the sound

[Chorus]
${hookLine}
${chorusLines.join("\n")}
${content.signatureLine}

[Verse 2]
Same fire, new direction
Built from pressure and connection
${verse2Lines.join("\n")}

[Bridge]
${bridgeLines.join("\n")}
Hold the silence
Shape the wave

[Final Chorus]
${hookLine}
${chorusLines.join("\n")}
${content.signatureLine}

[Outro]
(fading vocal echo)
${content.signatureLine}
${densityNote}`.trim();
  }

  return `[Intro]
(${content.introCue})

${styleTag}

[Verse 1]
${theme}
${content.signatureLine}
${verseLines.join("\n")}

[Pre-Chorus]
${energyLine}
Take control, don't slow it down

[Chorus]
${hookLine}
${chorusLines.join("\n")}

[Verse 2]
Same rhythm, new direction
Built on sound and tension
${verse2Lines.join("\n")}

[Bridge]
${bridgeLines.join("\n")}

[Chorus]
${hookLine}
${chorusLines.join("\n")}

[Outro]
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
  const content = applyLanguageFlavor(baseContent, styleLabel, lyricLanguage);
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
    return {
      lyrics: bracketizeSunoPromptBlock(`LYRIC DIRECTION · ${styleLabel}
Language: ${lyricLanguage}
Theme: ${theme}
Style: ${styleLabel} — ${styleDirection}
Structure: ${lyricStructure}
Mood: ${moodWords}
Density: ${densityText}
Signature hook example: ${content.signatureLine}
Write short singable lines with a strong repeated chorus.
Use [Verse], [Chorus], [Bridge], and [Outro] tags.
Match ${selectedGenres.join(" + ") || "the genre"} and ${styleDirection}.`),
      styleLabel,
      styleDirection,
      variantSeed,
    };
  }

  return {
    lyrics: buildStructuredLyrics({
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
  const content = applyLanguageFlavor(baseContent, styleLabel, lyricLanguage);
  const core = String(lyricTheme || idea || "the night").trim();
  const seed = computeSeed(mood, variantSeed);
  const hookPool = content.hooks || [content.signatureLine];
  const h1 = hookPool[seed % hookPool.length];
  const h2 = hookPool[(seed + 1) % hookPool.length];
  const h3 = hookPool[(seed + 2) % hookPool.length];
  const darkWord =
    lyricLanguage === "Swedish"
      ? mood.darkness > 65
        ? "natten"
        : "ljuset"
      : mood.darkness > 65
        ? "night"
        : "light";
  const energyWord =
    lyricLanguage === "Swedish"
      ? mood.energy > 70
        ? "tänd"
        : "andas"
      : mood.energy > 70
        ? "ignite"
        : "breathe";

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
Feel the bass in the ${darkWord}

2.
${h2}
We don't stop, we ${energyWord}

3.
${h3}
${content.signatureLine}`;

  return { hooks, styleLabel, styleDirection };
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
