// Community-derived, non-official prompt vocabulary index for Suno-style workflows.
// Synthesized from public guides and community tutorials.

export { referencePromptBlocks, stylePromptCatalog } from "./style-prompt-catalog";

import {
  formatPromptSymbolGuidePlain,
  formatVocalArtifactGuidePlain,
  promptSymbolExamples,
  promptSymbolOverview,
  promptSymbolUsageTips,
  sunoVocalArtifactGuide,
} from "./prompt-symbol-guide";

import { SUNO_LIMITS_PRINCIPLE } from "./suno-limits";

export {
  formatPromptSymbolGuidePlain,
  formatVocalArtifactGuidePlain,
  promptSymbolExamples,
  promptSymbolOverview,
  promptSymbolUsageTips,
  sunoVocalArtifactGuide,
};

export const sunoLanguageIndex = {
  principles: [
    SUNO_LIMITS_PRINCIPLE,
    "Keep style prompt focused on sonic palette (genre, mood, instruments, vocal intent).",
    "Keep lyrics field focused on structure and lyrical content.",
    "Use clear section tags to reduce arrangement drift.",
    "Use 4-7 strong descriptors before adding advanced detail.",
    "Add explicit negative constraints for cleaner control.",
  ],
  structureTags: [
    "Intro",
    "Verse",
    "Verse 1",
    "Verse 2",
    "Pre-Chorus",
    "Chorus",
    "Final Chorus",
    "Bridge",
    "Instrumental",
    "Instrumental Break",
    "Break",
    "Build",
    "Drop",
    "Breakdown",
    "Hook",
    "Interlude",
    "Spoken Word",
    "Concert Intro",
    "Vocal Drone",
    "Outro",
    "End",
    "Fade Out",
  ],
  vocalTags: [
    "female lead vocal",
    "female group harmonies",
    "male baritone",
    "male/female duet roles (label each line)",
    "beatbox rhythmic vocal",
    "breathy soprano",
    "raspy lead vocal",
    "spoken word verse",
    "spoken word alternating with instrumental breaks",
    "stacked harmonies",
    "SATB choir stack (soprano alto tenor bass)",
    "massive layered chorus",
    "background vocal layers",
    "anthemic chorus",
    "whispered vocal",
    "choir textures",
    "arena crowd chant bed",
    "raw scream or shout (short, tagged)",
    "vocal drone intro (wordless, dark)",
    "emotion arc (fragile → angry → empowered — tag sections)",
    "autotuned delivery",
    "soulful vocal samples",
    "fictional language snippet (short, pronounceable)",
  ],
  productionTokens: [
    "compressed vocal",
    "dry close-mic vocal",
    "Hi-Fi mastering clarity",
    "Dolby Atmos spatial impression",
    "three-dimensional stereo image",
    "spacious reverb",
    "wide stereo image",
    "tape warmth",
    "lo-fi texture",
    "studio-polished mix",
    "warm vintage saturation",
    "dark club mix depth",
    "analog saturation",
    "clean low end",
    "sub-bass extension",
    "punchy transient drums",
    "side-chain pump to kick",
    "heavy transient compression",
  ],
  negativePrompting: [
    "no vocals",
    "instrumental only",
    "no vocal chops",
    "no mumbled speech",
    "no choir",
    "no harsh leads",
    "no busy arrangement",
    "no over-compressed radio polish",
    "no genre crossover drift",
    "no abrupt ending",
  ],
  styleBlueprint: [
    "Genre + subgenre + era anchor",
    "Mood + energy descriptor",
    "Core instruments and bass/drum intent",
    "Vocal intent (or instrumental-only guard)",
    "Production quality target",
  ],
  templates: {
    styleField:
      "dark techno, industrial edge, 128 BPM, heavy sub bass, metallic percussion, analog synth stabs, instrumental only, clean club-ready mix, no vocals",
    lyricsField:
      "[Intro]\n[Instrumental, tension build]\n\n[Verse 1]\n(lyrics...)\n\n[Pre-Chorus]\n(lyrics...)\n\n[Chorus]\n(repeatable hook...)\n\n[Bridge]\n(contrast section...)\n\n[Final Chorus]\n(variation of hook...)\n\n[Outro]\n[Fade Out]\n[End]",
    /** Paste into Suno Lyrics — meta on Intro line, curly braces for crowd FX, build/drop, SATB hint */
    lyricsFieldAdvanced: `[Intro: stadium crowd ambience, big applause, cheering, distant chanting "HEY! HEY!", stage reverb]

[Verse 1]
(line…)
(line…)

[Pre-Chorus]
(line…)

[Chorus — SATB layers, huge harmonies]
HOOK LINE IN ALL CAPS FOR EMPHASIS
(call and response line)

[Bridge]
(contrast…)

[Build]
(risers, snare roll, tension — short cues)

[Drop]
(full beat — bass + drums hit)

[Final Chorus]
(variation…)

[Outro]
{crowd cheering}
{big applause}
{chanting fades out}`,

    /** Alternate blocks — copy any fragment into your lyric sheet */
    lyricSnippets: {
      concertIntro:
        "[Concert Intro: live crowd noise, applause, distant chant, stadium verb — high energy]",
      vocalDrone:
        "[Vocal Drone Intro: dark, haunted, wordless ah/oh layers, low mix]",
      spokenSaxAlternation: `[Spoken]
(one spoken line)

[Instrumental Break — sax lead]
(measurable gap / instrumental line)

[Spoken]
(back to speech)`,

      screams: `[Pre-Chorus — intense]
(SHOUT: ONE WORD)

[Chorus]
REGULAR LINE
(raw scream — short)`,

      duet: `[Verse 1 — Jane]
(first voice line…)

[Verse 1 — John]
(second voice line…)

[Chorus — both]
(unison or harmony hook…)`,

      fxAdlibs: `(BOOM) (CLAP) [FX: whip]\nBracket or parens for one-shot FX and ad-libs.`,
      fictionalLang:
        "[Bridge — Elvish-style nonsense phrase, 2–4 words, melodic]\n(pronunciation-friendly syllables only)",
    },

    negativeBlock:
      "NO: vocals, vocal chops, mumbled speech, muddy mix, random genre switches",
  },

  /**
   * Grouped cookbook items for the UI (labels + copy text).
   * Convention: Title Case inside brackets [Section], curly braces for stage/crowd FX.
   */
  advancedLyricCookbook: [
    {
      id: "meta-intro",
      title: "Meta intro line (sonic staging in one tag)",
      body: `[Intro: stadium crowd ambience, big applause, cheering, distant chanting "HEY! HEY!", stage reverb]`,
    },
    {
      id: "curly-fx",
      title: "Curly-brace crowd / stage FX",
      body: `{crowd cheering}\n{big applause}\n{chanting fades out}`,
    },
    {
      id: "build-drop",
      title: "Build + Drop (EDM energy)",
      body: `[Build]\n(risers, filter opens, snare roll)\n\n[Drop]\n(full drums and bass impact — short cue lines only)`,
    },
    {
      id: "satb-choir",
      title: "Massive chorus / SATB",
      body: `[Chorus — SATB layers]\n(soprano / alto / tenor / bass — describe stack or call-and-response)\n\nOr: [Chorus — layered choir, doubled hook]`,
    },
    {
      id: "uppercase-emphasis",
      title: "Uppercase hook emphasis",
      body: `Use ALL CAPS on key lines or words for intensity, e.g.\nWE RISE TOGETHER\nor single words: FOREVER / FREE`,
    },
    {
      id: "emotion-acting",
      title: "Emotion / acting tags on sections",
      body: `[Verse 1 — fragile, intimate delivery]\n[Verse 2 — angry, clipped]\n[Chorus — empowered, open throat]`,
    },
    {
      id: "scream-shout",
      title: "Screams / shouts (keep short)",
      body: `[Shout: NOW!]\n(raw scream — one breath)\n(SCREAM ad-lib at end of bar)`,
    },
    {
      id: "spoken-alt-breaks",
      title: "Spoken ↔ instrument alternation",
      body: `[Spoken]\n(line…)\n\n[Instrumental Break — sax solo]\n(…)\n\n[Spoken]\n(line…)`,
    },
    {
      id: "duet-roles",
      title: "Duets (label roles)",
      body: `[Verse — Female lead:]\nline…\n\n[Verse — Male lead:]\nline…\n\n[Chorus — duet harmony]\nhook…`,
    },
    {
      id: "onomatopoeia",
      title: "Onomatopoeia / FX ad-libs",
      body: `(BOOM) (CLAP) [FX: stomp]\nKeep FX sparse so arrangement stays readable.`,
    },
    {
      id: "fictional-lang",
      title: "Fictional languages",
      body: `2–6 syllable invented phrases only; melodic; avoid long exposition.\nExample: [Bridge — invented phrase]\n"aela ven korum"`,
    },
    {
      id: "instrumental-break-pipes",
      title: "DnB/Jungle-style break (block vocal-as-texture)",
      body: `[Break | Instrumental Only | No Vocals | Do Not Use Lyrics as FX]`,
    },
  ],
  promptSymbolOverview,
  promptSymbolUsageTips,
  promptSymbolExamples,
  sunoVocalArtifactGuide,
  /** Short narrative anchors (display / docs only). */
  genreAnchors: {
    techno: ["driving 4/4 kick", "industrial textures", "dark warehouse mood"],
    "detroit techno": ["shuffle swing hats", "analog sequencer soul", "warehouse hypnosis"],
    dnb: ["rolling breakbeats", "reese bass", "high-energy tension"],
    ambient: ["evolving pads", "slow movement", "wide atmospheric space"],
    cinematic: ["orchestral swells", "impact drums", "epic dynamic arc"],
    classical: ["sectional dynamics", "bowed strings and brass clarity", "controlled vibrato"],
    worship: ["open harmonic cadences", "congregation-sized lift", "wide congregational verb"],
    bluegrass: ["bright acoustic stack", "fast picking clarity", "high-and-lonesome harmony"],
    trap: ["808 sub bass", "tight hats", "modern vocal processing"],
    drill: ["sliding 808 phrases", "urgent hi-hat rolls", "minimal melodic clutter"],
    dubstep: ["half-time swing", "wobble or tear bass", "impact drops"],
    trance: ["supersaw lift", "filter-sweep tension", "long euphoric plateau"],
    pop: ["hook-forward chorus", "clean arrangement", "radio-ready polish"],
    chillwave: ["nostalgic cassette band", "soft pumping sidechain", "dreamy chorus guitars"],
    metal: ["high-gain guitar layers", "double-kick drive when needed", "dense wall of guitars"],
    world: ["regional percussion identity", "modal scales", "earthy acoustic layers"],
  },
};

/**
 * Single source of truth for Apply Genre Anchors (sounds, rhythms, optional rule line).
 * Keys match lowercase `genreOptions` labels from music-config.
 */
export const GENRE_ANCHOR_ENTRIES = [
  {
    keys: ["techno", "industrial"],
    sounds: ["Heavy sub bass", "Metallic percussion"],
    rhythms: ["4/4", "Syncopated"],
    rule: "driving 4/4 kick with industrial texture",
  },
  {
    keys: ["drum & bass", "jungle"],
    sounds: ["Distorted bass", "Dub delays"],
    rhythms: ["Breakbeat", "Rolling"],
    rule: "rolling breakbeat momentum and reese-style bass behavior",
  },
  {
    keys: ["ambient"],
    sounds: ["Dark pads", "Noise atmosphere"],
    rhythms: ["Minimal", "No drums"],
    rule: "slow evolving atmosphere with wide spatial depth",
  },
  {
    keys: ["cinematic", "orchestral"],
    sounds: ["Orchestral strings", "Big drums"],
    rhythms: ["Halftime"],
    rule: "cinematic dynamic arc with impact-driven transitions",
  },
  {
    keys: ["trap"],
    sounds: ["808 bass", "Glitch FX"],
    rhythms: ["Halftime", "Swing"],
    rule: "tight low end with modern trap hat movement",
  },
  {
    keys: ["pop"],
    sounds: ["Bright leads", "Soft drums"],
    rhythms: ["4/4"],
    rule: "hook-forward arrangement and clean vocal-forward mix",
  },
  {
    keys: ["house"],
    sounds: ["Heavy sub bass", "Analog synths"],
    rhythms: ["4/4", "Rolling"],
    rule: "four-on-the-floor groove with warm club bass and synth stabs",
  },
  {
    keys: ["hip hop"],
    sounds: ["808 bass", "Vinyl texture"],
    rhythms: ["Boom Bap", "Swing"],
    rule: "classic hip-hop pocket and sample-friendly warmth",
  },
  {
    keys: ["rock"],
    sounds: ["Distorted bass", "Metallic percussion"],
    rhythms: ["4/4"],
    rule: "guitar-driven energy with live-band forward mix",
  },
  {
    keys: ["jazz"],
    sounds: ["Piano", "Soft drums"],
    rhythms: ["Swing"],
    rule: "swing feel with acoustic warmth and breathing arrangement",
  },
  {
    keys: ["experimental"],
    sounds: ["Glitch FX", "Noise atmosphere"],
    rhythms: ["Off-grid", "Minimal"],
    rule: "textural experimentation without predictable pop structure",
  },
  {
    keys: ["synthwave"],
    sounds: ["Analog synths", "Bright leads"],
    rhythms: ["4/4"],
    rule: "retro-future pads and neon leads with driving pulse",
  },
  {
    keys: ["future bass"],
    sounds: ["Heavy sub bass", "Bright leads"],
    rhythms: ["Rolling", "Syncopated"],
    rule: "wide supersaw chords with punchy subs and emotional lift",
  },
  {
    keys: ["classical"],
    sounds: ["Orchestral strings", "Piano"],
    rhythms: ["4/4", "Minimal"],
    rule: "controlled orchestral dynamics with clear melodic lines",
  },
  {
    keys: ["folk", "americana", "country", "bluegrass"],
    sounds: ["Guitar", "Soft drums", "Hand percussion"],
    rhythms: ["Swing", "4/4"],
    rule: "acoustic-forward storytelling mix with earthy transients",
  },
  {
    keys: ["worship", "gospel"],
    sounds: ["Piano", "Orchestral strings", "Choir texture"],
    rhythms: ["4/4"],
    rule: "wide uplifting harmonies and spacious reverberant vocals",
  },
  {
    keys: ["metal", "folk metal"],
    sounds: ["Distorted bass", "Guitar", "Metallic percussion"],
    rhythms: ["4/4", "Double-time"],
    rule: "high-gain layering with anthemic rhythmic drive",
  },
  {
    keys: ["drill"],
    sounds: ["808 bass", "Metallic percussion"],
    rhythms: ["Drill groove", "Rolling"],
    rule: "minimal chords, sliding bass, urgent hats",
  },
  {
    keys: ["chillwave"],
    sounds: ["Analog synths", "Dark pads", "Vinyl texture"],
    rhythms: ["4/4", "Minimal"],
    rule: "nostalgic lo-fi warmth with soft side-chain breathing",
  },
  {
    keys: ["dubstep"],
    sounds: ["Heavy sub bass", "Wobble bass", "Glitch FX"],
    rhythms: ["Halftime", "Syncopated"],
    rule: "half-time weight and dramatic bass-focused drops",
  },
  {
    keys: ["trance"],
    sounds: ["Bright leads", "Analog synths", "Pad synth"],
    rhythms: ["4/4", "Rolling"],
    rule: "arpeggiated momentum with euphoric sustained lift",
  },
  {
    keys: ["breakcore"],
    sounds: ["Glitch FX", "Distorted bass"],
    rhythms: ["Breakbeat", "Off-grid"],
    rule: "fragmented drum edits and violent transient cuts",
  },
  {
    keys: ["reggae"],
    sounds: ["Heavy sub bass", "Dub delays"],
    rhythms: ["Off-grid", "Swing"],
    rule: "deep one-drop pocket with spring reverb flavor",
  },
  {
    keys: ["funk", "soul"],
    sounds: ["Bright leads", "Analog synths", "Guitar"],
    rhythms: ["Syncopated", "Swing"],
    rule: "syncopated bass-guitar interplay and expressive leads",
  },
  {
    keys: ["latin", "world"],
    sounds: ["Orchestral strings", "Metallic percussion", "World strings"],
    rhythms: ["Syncopated", "Tribal"],
    rule: "clear regional percussion roles with airy top-end",
  },
  {
    keys: ["game music"],
    sounds: ["Bright leads", "Analog synths", "Hand percussion"],
    rhythms: ["4/4", "Rolling"],
    rule: "motif-led loops with immediate identifiable hooks",
  },
  {
    keys: ["new wave"],
    sounds: ["Bright leads", "Analog synths"],
    rhythms: ["4/4", "Syncopated"],
    rule: "chorused guitars and punchy synthetic drums",
  },
  {
    keys: ["r&b", "neo-soul", "contemporary r&b"],
    sounds: ["Rhodes electric piano", "Soft drums", "808 bass"],
    rhythms: ["Swing", "Syncopated"],
    rule: "smooth groove with warm keys and intimate vocal-forward mix",
  },
  {
    keys: ["reggaeton", "dembow", "latin"],
    sounds: ["808 bass", "Hand percussion", "Metallic percussion"],
    rhythms: ["Dembow bounce", "Syncopated"],
    rule: "dembow kick pattern with tight reggaeton hat rolls",
  },
  {
    keys: ["phonk", "cloud rap"],
    sounds: ["808 bass", "Vinyl texture", "Distorted bass"],
    rhythms: ["Halftime", "Drill groove"],
    rule: "memphis-style sampled darkness with crushed low end",
  },
  {
    keys: ["afrobeats", "afrobeat", "highlife"],
    sounds: ["Hand percussion", "Bright leads", "Guitar"],
    rhythms: ["Syncopated", "Tribal"],
    rule: "polyrhythmic percussion pocket with melodic hook lift",
  },
  {
    keys: ["k-pop", "j-pop", "hyperpop"],
    sounds: ["Bright leads", "Supersaw chords", "Soft drums"],
    rhythms: ["4/4", "Rolling"],
    rule: "hook-dense arrangement with polished pop production",
  },
  {
    keys: ["hardstyle", "gabber", "hardcore"],
    sounds: ["Distorted bass", "Metallic percussion", "Side-chain pump"],
    rhythms: ["4/4", "Double-time"],
    rule: "distorted kick drive with relentless four-on-the-floor energy",
  },
  {
    keys: ["blues", "chicago blues"],
    sounds: ["Guitar", "Piano", "Dark saxophone"],
    rhythms: ["Shuffle", "Swing"],
    rule: "12-bar feel with expressive guitar and vocal call-and-response",
  },
  {
    keys: ["bossa nova", "samba", "latin jazz"],
    sounds: ["Nylon classical guitar", "Soft drums", "Dark saxophone"],
    rhythms: ["Bossa groove", "Samba groove"],
    rule: "syncopated nylon guitar with light brush percussion",
  },
  {
    keys: ["bollywood", "indian classical"],
    sounds: ["Sitar", "Tabla", "Orchestral strings"],
    rhythms: ["Tribal", "Syncopated"],
    rule: "melodic raga color with tabla rhythmic cycles",
  },
  {
    keys: ["detroit techno"],
    sounds: ["Analog synths", "Heavy sub bass", "Vinyl texture"],
    rhythms: ["4/4", "Shuffle"],
    rule: "shuffle hats with analog sequencer soul and warehouse hypnosis",
  },
  {
    keys: ["lo-fi hip hop"],
    sounds: ["Vinyl texture", "Piano", "Soft drums"],
    rhythms: ["Boom Bap", "Swing"],
    rule: "dusty sample warmth with relaxed swung drums",
  },
];

/**
 * @param {string[]} selectedGenres - e.g. from UI genre pills
 * @returns {{ sounds: string[], rhythms: string[], rules: string[] }}
 */
export function collectGenreAnchors(selectedGenres) {
  const genreSet = new Set(selectedGenres.map((g) => g.toLowerCase()));
  const sounds = [];
  const rhythms = [];
  const rules = [];

  for (const entry of GENRE_ANCHOR_ENTRIES) {
    const hit = entry.keys.some((k) => genreSet.has(k));
    if (!hit) continue;
    sounds.push(...entry.sounds);
    rhythms.push(...entry.rhythms);
    if (entry.rule) rules.push(entry.rule);
  }

  return {
    sounds: [...new Set(sounds)],
    rhythms: [...new Set(rhythms)],
    rules: [...new Set(rules)],
  };
}
