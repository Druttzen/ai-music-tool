// Community-derived, non-official prompt vocabulary index for Suno-style workflows.
// Synthesized from public guides and community tutorials.

export const sunoLanguageIndex = {
  principles: [
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
    "Bridge",
    "Instrumental",
    "Instrumental Break",
    "Break",
    "Build",
    "Drop",
    "Breakdown",
    "Hook",
    "Interlude",
    "Outro",
    "End",
    "Fade Out",
  ],
  vocalTags: [
    "female lead vocal",
    "male baritone",
    "breathy soprano",
    "raspy lead vocal",
    "spoken word verse",
    "stacked harmonies",
    "anthemic chorus",
    "whispered vocal",
    "choir textures",
    "autotuned delivery",
  ],
  productionTokens: [
    "compressed vocal",
    "dry close-mic vocal",
    "spacious reverb",
    "wide stereo image",
    "tape warmth",
    "lo-fi texture",
    "studio-polished mix",
    "analog saturation",
    "clean low end",
    "punchy transient drums",
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
    negativeBlock:
      "NO: vocals, vocal chops, mumbled speech, muddy mix, random genre switches",
  },
  /** Short narrative anchors (display / docs only). */
  genreAnchors: {
    techno: ["driving 4/4 kick", "industrial textures", "dark warehouse mood"],
    dnb: ["rolling breakbeats", "reese bass", "high-energy tension"],
    ambient: ["evolving pads", "slow movement", "wide atmospheric space"],
    cinematic: ["orchestral swells", "impact drums", "epic dynamic arc"],
    trap: ["808 sub bass", "tight hats", "modern vocal processing"],
    pop: ["hook-forward chorus", "clean arrangement", "radio-ready polish"],
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
