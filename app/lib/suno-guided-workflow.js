import { stylePresets } from "./music-config";
import { SUNO_LYRICS_CHAR_TYPICAL_MAX, SUNO_STYLE_CHAR_CAP } from "./suno-limits";
import { selectNegativeGuards, INSTRUMENTAL_LYRICS_SCAFFOLD } from "./suno-negative-guards";
import { formatTempoWithDescriptor, tempoAlreadyHasDescriptor } from "./tempo-descriptors";
import { scorePromptHints } from "./track-scoring";

/** One-line blurb for factory Style Preset buttons (left column). */
export const FACTORY_PRESET_BLURBS = {
  "Techno Core": "130 BPM • Techno+Industrial • club drop structure",
  "Jungle / DnB": "174 BPM • DnB+Jungle • breaks & sub",
  "Cinematic Hybrid": "95 BPM • orchestral+choir • film arc",
  "Ambient Flow": "60 BPM • pads+texture • no fixed sections",
  "Trap Night": "140 BPM • Trap+Hip Hop • halftime 808",
  "Pop Anthem": "118 BPM • Pop+Synth Pop • hook-forward",
  "Lo-Fi Study": "82 BPM • Lo-Fi+Jazz • dusty Rhodes loop",
  "Reggaeton Heat": "95 BPM • Reggaeton+Latin • dembow pocket",
  "Metal Forge": "150 BPM • Metal • double-time drive",
  "Jazz Lounge": "105 BPM • Smooth Jazz • swing & sax",
  "Afrobeats Pulse": "102 BPM • Afrobeats+R&B • syncopated groove",
  "Detroit Techno": "128 BPM • Detroit Techno • shuffle hats",
};

/**
 * One-line workflow: what to do, where, what’s next, and a success tip.
 * Steps 0–7: preset → feel → groove → vocal+rules → story → lyrics → polish → final copy.
 */
export const SUNO_GUIDED_STEPS = [
  {
    id: 0,
    name: "Style preset",
    preset: true,
    line: "Choose whether this track is Lyrics or Instrumental. For Instrumental only, you can allow Vocal FX (chops/textures, no real lyrics). Then load a factory preset or build by hand — presets set genres, tempo, sounds, structure, and vocal role.",
    where: "This panel (below) and left column: Style Presets. Music Controls (Vocal chip) can still override later.",
    next: "Set mood & engine: Mood Sliders and Mode (Control / Hybrid / Chaos) to match the vibe you want before refining chips.",
    optimal: `Factory presets: ${Object.keys(stylePresets).length} one-click baselines. Use them when you know the “family” (e.g. Jungle/DnB for breakbeat tracks). You can still edit every field after load.`,
  },
  {
    id: 1,
    name: "Mood & mode",
    line: "Lock feel: use Mood Sliders and Mode so energy/darkness/aggression match the preset or your manual genre choice.",
    where: "Mood Sliders and Mode panel in the left column. Tempo: Pro Mode (tempo field) or it came from the preset.",
    next: "Refine Music Controls — genres (1–2 primary), rhythm lines, 2–4 sound modules.",
    optimal: "Suno’s Style line weights the beginning most: after a preset, tweak mood sliders *before* adding new adjectives to Rules.",
  },
  {
    id: 2,
    name: "Groove & sound",
    line: "Add groove + palette: Rhythm and Sound modules must support the main genre (e.g. Rolling + Dub delays for DnB).",
    where: "Step 3 — Music Controls: Genres, Rhythm, Sound, then Vocal in the next step if you need to override the preset’s vocal.",
    next: "Vocal role + safety rules — instrumental vs lead, and explicit no-chop / no-mumble lines for breaks.",
    optimal: "If a preset is too ‘busy’, remove 1–2 sound chips first before changing genre — smaller edits keep identity stable.",
  },
  {
    id: 3,
    name: "Vocal & rules",
    line: "Vocal + safety: confirm Vocal chip; tighten Rules (short lines) — especially for instrumental or atmospheric sections.",
    where: "Music Controls (Vocal) + Pro Mode Rules, or the Rules area you always use.",
    next: "Creative story: Idea box + Pro structure; optional Apply Genre Anchors in the Suno index if your genres have anchors listed.",
    optimal: "For Jungle/DnB/dub, add explicit 'no mumbled vocal texture' in breaks — matches the in-app Suno texture guide.",
  },
  {
    id: 4,
    name: "Idea & form",
    line: "Idea + structure: clear goal one-liner; section map (verse → drop…) in Pro. Keep the Style *sound*; story lives in lyrics.",
    where: "Step 1 — Idea; Pro Mode for Structure; Lyric theme/structure feeds the Lyrics field, not the Style cap.",
    next: "Lyric engine: theme, style, language, mode — and optional Co-Producer hooks/lyrics when you need a draft.",
    optimal: "Longer narrative = Lyrics field. If Style approaches 1000 characters, move prose out of Rules into Lyrics direction.",
  },
  {
    id: 5,
    name: "Lyric direction",
    line: "Lyric direction: set theme, style, and mode so the app builds your Suno ‘Lyrics’ field coherently with bracket rules.",
    where: "Lyric Style Generator — pick Lyric Style, then Co-Producer · Generate Lyrics for a draft matched to that style prompt.",
    next: "Polish step: optional Voice Character Studio (trait map from vocal audio), Suno Voice Style, then analyzers if you want track/image DNA.",
    optimal: "Use [Verse] / [Chorus] in generated content so Suno can section correctly; keep Style box for sound only.",
  },
  {
    id: 6,
    name: "Polish",
    line: "Polish before export — Voice Character Studio (optional vocal trait map), Voice Style, Genre Anchors, Co-Producer, variations. Optional: drop a reference track (LUFS meter, studio WAV export, merge into Suno).",
    where: "Center column: Voice Character Studio (below Voice Style), Drag & Drop Analyzers, Co-Producer, Variation Engine. Right column: Suno Language Index — all optional.",
    next: "When satisfied (with or without analyzers), open the final step and copy Style + Lyrics into Suno.",
    optimal: "You can press Next and go straight to the copy step without ever opening the analyzers — they’re extra tools, not a gate.",
  },
  {
    id: 7,
    name: "Copy to Suno",
    line: "You’re ready: use the two copy blocks — Style (≤1000 chars) into Suno’s Style of Music, Lyrics into Lyrics. Re-import here to iterate.",
    where: "Below. Other copies (full prompt, style-only from Prompt Preview) still work for power users.",
    next: "In Suno: generate → if drift, return here, shorten Style first, then tweak Lyrics.",
    optimal: "If you use a new factory preset, walk steps 0–1 again; custom presets you saved are great for *your* recurring sound.",
  },
];

/**
 * Cumulative one-line “Style so far” preview (not necessarily under 1000 until final).
 * Steps 0–1: identity; 2: groove; 3: vocal+rules; 4: story; 5+: voice ref.
 * @param {number} maxStep 0..7
 */
export function getProgressiveStyleFragment(p, maxStep) {
  if (maxStep < 0) return "";
  const slice = {
    ...p,
    selectedSounds: maxStep >= 2 ? p.selectedSounds : [],
    selectedRhythms: maxStep >= 2 ? p.selectedRhythms : [],
    vocal: maxStep >= 3 ? p.vocal : "Instrumental",
    instrumentalVocalFx: maxStep >= 3 ? p.instrumentalVocalFx : false,
    rules: maxStep >= 3 ? p.rules : "",
    idea: maxStep >= 4 ? p.idea : "",
    voiceStyleLine: maxStep >= 5 ? p.voiceStyleLine : "",
    voiceStyleReference: maxStep >= 5 ? p.voiceStyleReference : "",
  };
  return buildSunoPastedStyleLine(slice);
}

function normalizeToken(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushTokens(parts, items) {
  for (const item of items) {
    const t = normalizeToken(item);
    if (t) parts.push(t);
  }
}

/**
 * Join comma-separated style tokens and cap at Suno’s Style limit (1000).
 */
function joinWithCap(parts, cap, separator = ", ") {
  const clean = parts.map(normalizeToken).filter(Boolean);
  let s = clean.join(separator);
  if (s.length <= cap) return s;
  for (let n = clean.length - 1; n >= 1 && s.length > cap; n--) {
    s = clean.slice(0, n).join(separator);
  }
  if (s.length > cap) {
    s = s.slice(0, cap - 1) + "…";
  }
  return s;
}

/** Map lyric structure text to bracket section tags (Lyrics field only). */
export function structureToSectionTags(structure) {
  const raw = normalizeToken(structure);
  if (!raw) return [];
  return raw
    .split(/\s*(?:→|->|,|\/)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment, i) => {
      const lower = segment.toLowerCase();
      if (/final\s+chorus/.test(lower)) return "Final Chorus";
      if (/pre[-\s]?chorus/.test(lower)) return "Pre-Chorus";
      if (/post[-\s]?chorus/.test(lower)) return "Post-Chorus";
      if (lower.includes("chorus")) return "Chorus";
      if (lower.includes("bridge")) return "Bridge";
      if (lower.includes("intro")) return "Intro";
      if (lower.includes("outro")) return "Outro";
      if (lower.includes("verse")) return i === 0 ? "Verse 1" : `Verse ${i + 1}`;
      if (lower.includes("drop")) return "Drop";
      if (lower.includes("build")) return "Build";
      return segment
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    });
}

/** True when no user-facing Suno paste fields are set (guided step 1 blank slate). */
export function isGuidedPasteBlank(p) {
  const genres = p.selectedGenres || [];
  const sounds = p.selectedSounds || [];
  const rhythms = p.selectedRhythms || [];
  const vocal = p.vocal || "";
  if (genres.length || sounds.length || rhythms.length || vocal) return false;
  if (normalizeToken(p.idea)) return false;
  if (normalizeToken(p.rules)) return false;
  if (normalizeToken(p.tempo)) return false;
  if (normalizeToken(p.voiceStyleLine || p.voiceStyleReference)) return false;
  if (normalizeToken(p.generatedLyrics)) return false;
  if (normalizeToken(p.lyricTheme) || normalizeToken(p.lyricStructure)) return false;
  const mood = (p.moodWords || "").trim();
  // Neutral reset sliders produce "balanced" — still blank for paste previews.
  if (mood && mood !== "balanced") return false;
  return true;
}

/** Minimal bracket scaffold — lyric lines only, no direction meta. */
export function buildMinimalLyricsScaffold({ lyricTheme = "", lyricStructure = "" }) {
  const theme = normalizeToken(lyricTheme);
  const tags = structureToSectionTags(lyricStructure);
  if (!tags.length) {
    if (!theme) return "";
    return `[Verse 1]\n${theme}\n\n[Chorus]\n${theme}`;
  }
  return tags
    .map((tag, i) => {
      const line = i === 0 && theme ? theme : "";
      return line ? `[${tag}]\n${line}` : `[${tag}]`;
    })
    .join("\n\n");
}

/**
 * **Final** Suno “Style of Music” paste: priority-ordered, always ≤ 1000 characters.
 * Sound-first, compact — safe for one-shot copy into Suno.
 */
export function buildSunoPastedStyleLine(p) {
  if (isGuidedPasteBlank(p)) return "";

  const {
    selectedGenres = [],
    tempo = "",
    moodWords = "",
    selectedSounds = [],
    selectedRhythms = [],
    vocal = "",
    instrumentalVocalFx = false,
    idea = "",
    rules = "",
    voiceStyleReference = "",
    voiceStyleLine = "",
    scores = null,
  } = p;
  const voiceRef = normalizeToken(voiceStyleLine || voiceStyleReference).slice(0, 120);

  const parts = [];
  if (selectedGenres.length) pushTokens(parts, selectedGenres);
  const tempoLine =
    tempo && !tempoAlreadyHasDescriptor(tempo) ? formatTempoWithDescriptor(tempo) : tempo;
  if (tempoLine) parts.push(tempoLine);
  if (moodWords) pushTokens(parts, moodWords.split(/,\s*/));
  if (vocal === "Instrumental") {
    const guards = selectNegativeGuards({ vocal, rules, max: 3 });
    parts.push(
      instrumentalVocalFx
        ? "instrumental, vocal FX only, no sung lyrics"
        : guards.length
          ? `instrumental, ${guards.join(", ")}`
          : "instrumental, no vocals, no vocal chops, no mumbled texture",
    );
  } else if (vocal) {
    parts.push(vocal);
  }
  pushTokens(parts, (selectedSounds || []).slice(0, 6));
  pushTokens(parts, (selectedRhythms || []).slice(0, 4));
  const goal = normalizeToken(idea).slice(0, 120);
  if (goal) parts.push(goal);
  const r = normalizeToken(rules).replace(/\n/g, ", ");
  if (r) pushTokens(parts, r.split(/,\s*/).slice(0, 10));
  if (voiceRef && vocal !== "Instrumental") parts.push(voiceRef);
  pushTokens(parts, scorePromptHints(scores));

  return joinWithCap(parts, SUNO_STYLE_CHAR_CAP);
}

/**
 * **Final** Suno Lyrics field — priority-ordered (metadata first, lyric body last to drop).
 * Vocal tags and section brackets survive trimming longer than prose tails.
 */
export function buildSunoPastedLyricsField(p) {
  if (isGuidedPasteBlank(p)) return "";

  const vocal = p.vocal || "";
  if (vocal === "Instrumental") {
    return INSTRUMENTAL_LYRICS_SCAFFOLD;
  }
  if (!vocal) return "";

  const generated = normalizeToken(p.generatedLyrics);
  if (generated) {
    return joinWithCap([generated], SUNO_LYRICS_CHAR_TYPICAL_MAX, "\n\n");
  }

  const scaffold = buildMinimalLyricsScaffold({
    lyricTheme: p.lyricTheme,
    lyricStructure: p.lyricStructure,
  });
  if (scaffold) {
    return joinWithCap([scaffold], SUNO_LYRICS_CHAR_TYPICAL_MAX, "\n\n");
  }

  return "";
}

export function getStepCount() {
  return SUNO_GUIDED_STEPS.length;
}

/** 0-based index of the “Polish” step (analyzers / final polish before copy). */
export function getGuidedPolishStepIndex() {
  const i = SUNO_GUIDED_STEPS.findIndex((s) => s.name === "Polish");
  return i >= 0 ? i : 6;
}

/** Clamp guided path to the Polish (analyzer) step. */
export function resolvePolishStepIndex() {
  const max = getStepCount() - 1;
  const polish = getGuidedPolishStepIndex();
  return Math.min(max, Math.max(0, polish));
}

/** Short caption under “Live Style preview” — what this step’s preview includes vs later steps. */
export function getSunoStylePreviewHint(stepIndex) {
  if (stepIndex < 0) return "";
  if (stepIndex < 2) return "Shows identity only (genres, tempo, mood). Rhythm & sound chips join at step 3.";
  if (stepIndex < 3) return "Includes groove & sound palette when you’ve selected chips.";
  if (stepIndex < 4) return "Adds vocal role and rules.";
  if (stepIndex < 5) return "Adds idea and structure lines (walkthrough order).";
  if (stepIndex < 6) return "Adds voice reference when set (omitted for instrumental).";
  if (stepIndex < 7) {
    return "Polish step: Voice Character Studio, analyzers, and Co-Producer are optional — use Next whenever you're ready to copy.";
  }
  return "Use the two copy blocks only — the Style line is 1000-safe and re-ordered for Suno (not the same as the walkthrough string above).";
}
