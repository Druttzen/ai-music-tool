/**
 * Prompt symbol reference (delimiter roles + examples) and Suno vocal-as-texture notes.
 * Source: user-provided symbol guide + DnB/Jungle vocal artifact workflow.
 */

export const promptSymbolOverview = [
  {
    symbol: ",",
    label: "Komma — Comma",
    role: "Separates attributes in a prompt list.",
    example: "Synthwave, 100 BPM, nostalgic",
  },
  {
    symbol: ";",
    label: "Semikolon — Semicolon",
    role: "Field-level separator in registers or templates (tag stacks).",
    example: "tag1;tag2;tag3",
  },
  {
    symbol: "()",
    label: "Parentes — Parentheses",
    role: "Extra information or weighting.",
    example: "male vocals (breathy)",
  },
  {
    symbol: "[]",
    label: "Hakparentes — Square brackets",
    role: "Optional content, placeholders, or section labels.",
    example: "[artist name]",
  },
  {
    symbol: "{}",
    label: "Måsvingar — Braces",
    role: "Variable or block to substitute (sections in some workflows).",
    example: "{CHORUS}",
  },
  {
    symbol: '""',
    label: "Citattecken — Double quotes",
    role: "Locks an exact phrase or lyric seed.",
    example: '"I feel the night"',
  },
  {
    symbol: "''",
    label: "Enkel citation — Single quotes",
    role: "Short phrases or light marking.",
    example: "'hook'",
  },
  {
    symbol: "+",
    label: "Plus",
    role: "Combines styles or hybrid elements.",
    example: "Trap + Orchestral",
  },
  {
    symbol: "-",
    label: "Bindestreck — Hyphen",
    role: "Range, modifier, or exclusion (e.g. instrumental).",
    example: "80-90 BPM / -vocal (exclude)",
  },
  {
    symbol: "<>",
    label: "Vinkelparentes — Angle brackets",
    role: "Metadata or technical tags in some tools.",
    example: "<stem:vox>",
  },
  {
    symbol: "[]:",
    label: "Hakparentes + kolon",
    role: "Common in templates for field labels.",
    example: "[BPM]:",
  },
  {
    symbol: "/",
    label: "Snedstreck — Slash",
    role: "Alternatives or “per” (verse/chorus).",
    example: "verse/chorus",
  },
  {
    symbol: "\\",
    label: "Backslash",
    role: "Escape character in some systems.",
    example: '\\" for a literal quote',
  },
  {
    symbol: "|",
    label: "Pipe",
    role: "Separator in short lists or UI fields.",
    example: "pop | dance | electronic",
  },
  {
    symbol: "*",
    label: "Asterisk",
    role: "Emphasis or wildcard (tool-dependent).",
    example: "*emphasis* / vocal*",
  },
  {
    symbol: "_",
    label: "Understreck — Underscore",
    role: "Word joining in tags or filenames.",
    example: "neo_soul",
  },
  {
    symbol: "=",
    label: "Likhetstecken — Equals",
    role: "Assignment in templates (key=value).",
    example: "mood=dark",
  },
  {
    symbol: ":",
    label: "Kolon — Colon",
    role: "Field label or time/tempo notation.",
    example: "mood:uplifting / BPM:128",
  },
  {
    symbol: "...",
    label: "Ellipsis",
    role: "Continuation or open-ended cue.",
    example: "build... drop",
  },
  {
    symbol: "!",
    label: "Utropstecken — Exclamation",
    role: "Strength or accent.",
    example: "energetic!",
  },
  {
    symbol: "?",
    label: "Frågetecken — Question mark",
    role: "Optional or uncertain clause.",
    example: "vocal? (optional)",
  },
  {
    symbol: "#",
    label: "Hash",
    role: "Tagging or metadata chips.",
    example: "#synthwave",
  },
  {
    symbol: "@",
    label: "Snabel-a — At",
    role: "Persona or reference hooks.",
    example: "@vocal_persona",
  },
  {
    symbol: "%",
    label: "Procent — Percent",
    role: "Mix ratio or blend.",
    example: "70% synth, 30% orchestra",
  },
  {
    symbol: "^",
    label: "Caret",
    role: "Weighting in some systems.",
    example: "chorus^2",
  },
  {
    symbol: "~",
    label: "Tilde",
    role: "Approximation or fuzziness.",
    example: "~120 BPM",
  },
  {
    symbol: "« »",
    label: "Guillemets",
    role: "Quotation or marking (locale/tool-specific).",
    example: "«hook»",
  },
  {
    symbol: "“ ”",
    label: "Typografiska citationer — Curly quotes",
    role: "Published lyrics or exact phrases.",
    example: "“Lost in neon”",
  },
  {
    symbol: "` `",
    label: "Backtick",
    role: "Inline code or exact tokens.",
    example: "`BPM=128`",
  },
  {
    symbol: "→",
    label: "Pil framåt — Arrow",
    role: "Direction or progression in maps.",
    example: "intro → drop → outro",
  },
  {
    symbol: "←",
    label: "Vänsterpil — Left arrow",
    role: "Return or loop reference.",
    example: "chorus ← verse",
  },
  {
    symbol: "°",
    symbolAlt: "degree",
    label: "Gradtecken — Degree",
    role: "Metaphor for filter/pitch/wetness in informal prompts.",
    example: "cutoff 45° (metaphor)",
  },
  {
    symbol: "(section sign, Unicode U+00A7)",
    label: "Paragraph / section sign",
    role: "Internal documentation markers; prefer plain text cues in Suno prompts until you verify behavior.",
    example: "internal note: arrangement hint",
  },
  {
    symbol: "¶",
    label: "Styckemarkör — Pilcrow",
    role: "Section / breakpoint notes in drafts.",
    example: "¶section break",
  },
];

export const promptSymbolUsageTips = [
  "Keep one consistent delimiter style in your personal register (e.g. always ; between tags).",
  "Use parentheses for secondary instructions; use quotes for exact lyric seeds.",
  "Iterate — long, dense single lines can behave unpredictably in generative models.",
];

/** Example lines grouped by delimiter (symbol key). */
export const promptSymbolExamples = {
  comma: [
    "Synthwave, 100 BPM, nostalgic, female vocals",
    "Lo-Fi Hip Hop, 70 BPM, chill, vinyl crackle",
    "Cinematic R&B, 75 BPM, emotional, piano-led",
    "Future Bass, 150 BPM, uplifting, bright synths",
    "Ambient Meditation, 60 BPM, calm, long pads",
  ],
  semicolon: [
    "synthwave;retro;80s;nostalgic",
    "lofi;chill;study;vinyl",
    "cinematic;rnb;emotional;piano",
    "futurebass;uplifting;pop;vocal-chops",
    "ambient;meditation;field-recordings;pads",
  ],
  parens: [
    "Dark Trap, 140 BPM, aggressive (heavy 808 emphasis)",
    "Indie Folk, 95 BPM, storytelling (intimate vocal)",
    "Synth Pop, 118 BPM, bright (catchy hook)",
    "Cinematic Hybrid, 100 BPM (strings + synths)",
    "Lo-Fi Jazzhop, 85 BPM (sax sample, vinyl crackle)",
  ],
  brackets: [
    "Chillout Lounge [mood:relaxed]",
    "Vocal House [export:stems]",
    "Reggaeton [language:es,en]",
    "Psytrance [build:long]",
    "Neo-Soul [harmony:rich]",
  ],
  braces: [
    "Progressive House, 128 BPM, {DROP}",
    "Trap Soul, 75 BPM, {VERSE}",
    "Epic Orchestral, 70 BPM, {CHORUS}",
    "Ambient Field Recording, 60 BPM, {TEXTURE}",
    "Synthwave, 100 BPM, {LEAD_HOOK}",
  ],
  doubleQuote: [
    '"I feel the night" — Cinematic R&B, 75 BPM',
    '"Take me higher" — Future Bass, 150 BPM',
    '"Lost in neon" — Synthwave, 100 BPM',
    '"Stay with me" — Neo-Soul Ballad, 70 BPM',
    '"Run away" — Indie Folk, 95 BPM',
  ],
  singleQuote: [
    "'hook' — Vocal House, 124 BPM",
    "'verse' — Lo-Fi Hip Hop, 70 BPM",
    "'bridge' — Cinematic Pop, 100 BPM",
    "'drop' — Progressive House, 128 BPM",
    "'outro' — Ambient, 60 BPM",
  ],
  plus: [
    "Trap + Orchestral, 140 BPM, hybrid beats and strings",
    "Synthwave + Future Bass, 120 BPM, neon leads + big drops",
    "Afrobeat + Funk, 105 BPM, horns + syncopated groove",
    "Vaporwave + Chillout, 90 BPM, dreamy chopped samples",
    "Cinematic + Electronic, 95 BPM, emotional hybrid",
  ],
  minus: [
    "80-90 BPM, Lo-Fi Hip Hop",
    "120-130 BPM, Progressive House",
    "Dark Trap - vocal (instrumental version)",
    "Synth Pop - heavy distortion",
    "Ambient 40-60 BPM - no percussion",
  ],
  angle: [
    "<stem:vox> export as stems",
    "<mood:uplifting> Synth Pop, 118 BPM",
    "<persona:male_airy> Cinematic R&B",
    "<format:loop> Lo-Fi beat, 70 BPM",
    "<lang:es> Latin Pop, 100 BPM",
  ],
  slash: [
    "verse/chorus structure, 100 BPM, pop",
    "intro/drop/outro, progressive house, 128 BPM",
    "guitar/bass/drums arrangement, indie rock",
    "pad/lead/bass layering, ambient techno",
    "loop/variation, lo-fi beat, 85 BPM",
  ],
  pipe: [
    "pop | dance | electronic — multi-tag prompt",
    "lofi | chill | study — playlist mood",
    "cinematic | epic | trailer — orchestral hybrid",
    "house | vocal | club — vocal house template",
    "ambient | field | texture — soundscape",
  ],
  star: [
    "*emphasis* on airy vocals — synth pop",
    "vocal* — match any vocal type (tool-dependent)",
    "pad* — include all pad variations",
    "chorus*2 — double chorus intensity (tool-dependent)",
    "*lead* prominent in mix — future bass",
  ],
  underscore: [
    "neo_soul_style — Neo-Soul Ballad, 70 BPM",
    "synthwave_chill — Synthwave Chill, 90 BPM",
    "lofi_jazzhop — Lo-Fi Jazzhop, 85 BPM",
    "vocal_house_club — Vocal House, 124 BPM",
    "ambient_field_recording — Ambient, 60 BPM",
  ],
  equals: [
    "mood=dark; genre=trap; bpm=140",
    "vocal=male; style=cinematic; bpm=75",
    "export=stems; format=wav",
    "intensity=high; build=long",
    "language=es; bilingual=true",
  ],
  colon: [
    "mood:uplifting; Synth Pop, 118 BPM",
    "BPM:128; Progressive House",
    "vocal_type:breathy; Indie Folk",
    "instrumentation:strings+piano; Orchestral",
    "notes:use gated snare; Synthwave",
  ],
  ellipsis: [
    "build... drop — Progressive House, 128 BPM",
    "intro...verse...chorus — cinematic structure",
    "ambient textures... slowly evolving",
    "loop...variation...outro — lo-fi beat",
    "fade...silence — meditative piano",
  ],
  bang: [
    "Energetic! Future Rave, 128 BPM",
    "Aggressive! Dark Trap, 140 BPM",
    "Uplifting! Cinematic Pop Anthem, 100 BPM",
    "Surprising! Glitch Hop, 110 BPM",
    "Powerful! Epic Orchestral, 70 BPM",
  ],
  question: [
    "vocal? — include optional vocal layer",
    'lyrics? "stay with me" — optional lyric seed',
    "bridge? — add a bridge section if needed",
    "stems? — export stems if available",
    "tempo? ~120 BPM — approximate tempo",
  ],
  hash: [
    "#synthwave #retro #80s",
    "#lofi #study #vinyl",
    "#cinematic #trailer #epic",
    "#kpop #hook #vocalstack",
    "#afrobeat #groove #horns",
  ],
  at: [
    "@vocal_persona: airy_female — use vocal style",
    "@producer:mad — reference production style",
    "@mood:nightdrive — synthwave prompt",
    "@instrument:rhodes — include electric piano",
    "@export:stems — prepare stems for DAW",
  ],
  percent: [
    "70% synth, 30% orchestra — hybrid",
    "50% vocal, 50% instrumental — balanced mix",
    "80% ambient, 20% field recordings",
    "60% drums, 40% bass — rhythmic focus",
    "30% vocal chops, 70% pads — texture emphasis",
  ],
  caret: [
    "chorus^2 — emphasize chorus twice (tool-dependent)",
    "lead^3 — make lead stronger (tool-dependent)",
    "pad^0.5 — reduce pad prominence",
    "vocal^1.5 — slightly boost vocal",
    "drop^4 — extreme drop emphasis (tool-dependent)",
  ],
  tilde: [
    "~120 BPM — approximate tempo",
    "~80-90 BPM — loose tempo range",
    "~vintage — roughly retro sound",
    "~lofi — approximate lo-fi texture",
    "~ambient — general ambient feel",
  ],
  guillemets: [
    "«hook» — mark the hook phrase",
    "«verse1» — label song section",
    "«bridge» — indicate bridge part",
    "«outro» — label ending",
    "«CHORUS» — uppercase emphasis on section",
  ],
  curlyQuotes: [
    "“Lost in neon” — synthwave lyric seed",
    "“Stay with me” — neo-soul lyric",
    "“Run away” — indie folk hook",
    "“Take me higher” — future bass chorus",
    "“I feel the night” — cinematic R&B line",
  ],
  backtick: [
    "`BPM=128` — exact token for automation",
    "`model=v4` — lock model version in metadata",
    "`export=wav` — exact export flag",
    "`stems=true` — precise instruction token",
    "`voice=airy_female` — exact persona token",
  ],
  arrowRight: [
    "intro → verse → chorus → drop",
    "build → release → outro",
    "pad → lead → solo",
    "ambient → tension → climax",
    "loop → variation → finish",
  ],
  arrowLeft: [
    "chorus ← verse — return to chorus from verse",
    "reprise ← chorus — bring back earlier theme",
    "loop ← intro — loop intro motif",
    "verse ← prechorus — revert to verse feel",
    "outro ← chorus — end with chorus motif",
  ],
  degree: [
    "cutoff 45° — filter position metaphor",
    "pitch +2° — slight pitch shift metaphor",
    "reverb 60° — wetness metaphor",
    "filter 30° lowpass — gentle rolloff metaphor",
    "eq tilt 5° — subtle tonal tilt metaphor",
  ],
  paragraphNote: [
    "note: use vintage compressor on drums (doc / internal cue)",
    "arrangement: keep chorus short (doc / internal cue)",
    "mix: leave headroom for vocals (doc / internal cue)",
    "legal: check sample clearance (doc / internal cue)",
    "workflow: export stems at -6dB (doc / internal cue)",
  ],
  pilcrow: [
    "¶section break — separate song parts",
    "¶arrangement note — add bridge here",
    "¶mix note — automate reverb",
    "¶lyric break — new stanza",
    "¶fade point — start fade here",
  ],
};

/** Suno: lyrics reused as blurred vocal texture (esp. Jungle / DnB / dub). */
export const sunoVocalArtifactGuide = {
  title: "Why Suno Turns Lyrics Into Mumbled “Synth” Sounds",
  summary:
    "What you hear is often the model re-using vocal material as texture — not a synth. Jungle, DnB, dub, and ambient breaks are strongly associated with chopped/time-stretched vocals.",
  causes: [
    {
      heading: "Atmospheric sections without explicit vocal rules",
      bullets: [
        "Words like atmospheric, dub space, FX only, pads/textures — without “no vocals here” — Suno may take lyric fragments, time-stretch, blur with reverb, use as ghost texture.",
        "Especially common in Jungle, DnB, dub, ambient breaks.",
      ],
    },
    {
      heading: "“Vocal texture”, “atmosphere”, “dub” phrasing",
      bullets: [
        "Even unintended phrases (dub-style breakdown, atmospheric bridge, echo-heavy space) can signal “vocals as effect” → smeared syllables instead of synth.",
      ],
    },
    {
      heading: "Lyrics present during non-lyric sections",
      bullets: [
        "If lyrics sit under sections labeled Intro / Break / Bridge / Outro, Suno may ignore labels and still pull material → background artifacts.",
      ],
    },
    {
      heading: "Genre bias",
      bullets: [
        "Jungle / DnB / 90s rave / dub correlate with vocal chops, MC fragments, formant-shifted speech — unless forbidden, defaults lean that way.",
      ],
    },
  ],
  fixes: [
    {
      heading: "Hard vocal exclusions",
      bullets: [
        "Good: [Break | Instrumental Only | No Vocals]",
        "Better: [Break | Instrumental Only | No Vocals | Do Not Use Lyrics as FX]",
        "Suno responds well to explicit negatives.",
      ],
    },
    {
      heading: "Separate lyrics from structure",
      bullets: [
        "Put lyrics only in Verse/Chorus blocks; leave other sections empty or FX-only cues.",
      ],
    },
    {
      heading: "Ban behaviors in the Style prompt",
      bullets: [
        "Example: No vocal chops, no mumbled speech textures, no formant-shifted vocals used as instruments.",
      ],
    },
    {
      heading: "Define atmosphere source",
      bullets: [
        'Instead of vague “atmospheric”: atmosphere from pads, noise, reverb tails, delay feedback — not vocals.',
      ],
    },
    {
      heading: "Templates vs free writing",
      bullets: [
        "Templates reuse structural language → stronger learned patterns; clearer explicit negatives reduce unintended reuse.",
      ],
    },
  ],
  diagnostic: {
    heading: "Quick diagnostic test",
    before: "[Break | Atmospheric | Dub Space]",
    after:
      "[Break | Instrumental Only | Pads & FX | No Vocals | No Lyric Fragments]",
    note: "If mumbling disappears, atmospheric wording was the trigger.",
  },
  bottomLine:
    "Atmosphere + lyrics present anywhere often reads as vocals-as-texture. Forbid vocal reuse, define non-vocal sound sources, keep lyrics out of non-lyrical sections — problem largely goes away.",
};

export function formatPromptSymbolGuidePlain() {
  let out = "SYMBOL OVERVIEW\n\n";
  for (const row of promptSymbolOverview) {
    const sym =
      "symbolAlt" in row && row.symbolAlt ? `${row.symbol} (${row.symbolAlt})` : row.symbol;
    out += `${sym} — ${row.label}\n${row.role}\nExample: ${row.example}\n\n`;
  }
  out += "USAGE TIPS\n";
  for (const t of promptSymbolUsageTips) out += `- ${t}\n`;
  out += "\nEXAMPLES BY DELIMITER\n";
  for (const [key, lines] of Object.entries(promptSymbolExamples)) {
    out += `\n[${key}]\n${lines.join("\n")}\n`;
  }
  return out.trim();
}

export function formatVocalArtifactGuidePlain(g = sunoVocalArtifactGuide) {
  let out = `${g.title}\n\n${g.summary}\n\n`;
  out += "CAUSES\n";
  for (const c of g.causes) {
    out += `\n${c.heading}\n`;
    for (const b of c.bullets) out += `- ${b}\n`;
  }
  out += "\nFIXES\n";
  for (const f of g.fixes) {
    out += `\n${f.heading}\n`;
    for (const b of f.bullets) out += `- ${b}\n`;
  }
  out += `\n${g.diagnostic.heading}\n`;
  out += `Before: ${g.diagnostic.before}\n`;
  out += `After: ${g.diagnostic.after}\n`;
  out += `${g.diagnostic.note}\n\n`;
  out += `Bottom line: ${g.bottomLine}`;
  return out;
}
