import { buildSunoLyricsBoxPrompt } from "./suno-rules";
import { stylePresets } from "./music-config";
import { SUNO_LYRICS_CHAR_TYPICAL_MAX, SUNO_STYLE_CHAR_CAP } from "./suno-limits";

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
    next: "Suno Voice Style (first/last) or famous presets, then voice style line — audio/image analyzers come later and are optional.",
    optimal: "Use [Verse] / [Chorus] in generated content so Suno can section correctly; keep Style box for sound only.",
  },
  {
    id: 6,
    name: "Polish",
    line: "Polish before export — Voice Style, Genre Anchors, Co-Producer, variations. Optional: drop a reference track (LUFS meter, studio WAV export, edit tags, drag highlight, merge into Suno).",
    where: "Right column: Drag & Drop Analyzers (track report, LUFS, studio export, image→style), Voice Style, Suno Language Index, Co-Producer, Variation Engine — optional.",
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
  const a = [];
  a.push((p.selectedGenres || []).join(", ") || "— set genres or load a preset —");
  a.push(p.tempo || "— tempo —", p.moodWords || "— mood —");
  if (maxStep < 2) return a.join(" | ");
  if (p.selectedSounds?.length) a.push(`sounds: ${p.selectedSounds.slice(0, 5).join(", ")}`);
  if (p.selectedRhythms?.length) a.push(`groove: ${p.selectedRhythms.join(", ")}`);
  if (maxStep < 3) return a.join(" | ");
  a.push(
    p.vocal === "Instrumental"
      ? p.instrumentalVocalFx
        ? "instrumental + vocal FX (no lyrics)"
        : "instrumental"
      : p.vocal || "vocal",
  );
  a.push(p.rules ? `rules: ${String(p.rules).slice(0, 80)}${String(p.rules).length > 80 ? "…" : ""}` : "— rules —");
  if (maxStep < 4) return a.join(" | ");
  a.push(p.idea ? `goal: ${String(p.idea).slice(0, 100)}` : "— idea —");
  a.push(p.structure ? `form: ${String(p.structure).slice(0, 60)}` : "— form —");
  if (maxStep < 5) return a.join(" | ");
  const vref = (p.voiceStyleLine || p.voiceStyleReference || "").trim();
  if (vref && p.vocal !== "Instrumental") a.push(`vocal ref: ${vref.slice(0, 60)}`);
  return a.join(" | ");
}

/**
 * Join parts with " | " and cap at Suno’s Style limit (1000) without breaking mid-unicode if possible.
 */
function joinWithCap(parts, cap) {
  const clean = parts
    .map((x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean);
  let s = clean.join(" | ");
  if (s.length <= cap) return s;
  for (let n = clean.length - 1; n >= 1 && s.length > cap; n--) {
    s = clean.slice(0, n).join(" | ");
  }
  if (s.length > cap) {
    s = s.slice(0, cap - 1) + "…";
  }
  return s;
}

/**
 * **Final** Suno “Style of Music” paste: priority-ordered, always ≤ 1000 characters.
 * Sound-first, compact — safe for one-shot copy into Suno.
 */
export function buildSunoPastedStyleLine(p) {
  const {
    selectedGenres = [],
    tempo = "",
    moodWords = "",
    selectedSounds = [],
    selectedRhythms = [],
    vocal = "Instrumental",
    instrumentalVocalFx = false,
    idea = "",
    structure = "",
    rules = "",
    mode = "Hybrid",
    voiceStyleReference = "",
    voiceStyleLine = "",
  } = p;
  const voiceRef = (voiceStyleLine || voiceStyleReference || "").trim();

  const parts = [];
  const g = selectedGenres.length ? selectedGenres.join(", ") : "electronic";
  parts.push(g);
  if (tempo) parts.push(tempo);
  if (moodWords) parts.push(moodWords);
  if (vocal === "Instrumental") {
    parts.push(
      instrumentalVocalFx
        ? "instrumental with vocal FX only (chops, textures, one-shots) — no sung lyrics"
        : "instrumental, no vocal chops, no mumbled texture",
    );
  } else {
    parts.push(vocal || "vocals");
  }
  if (selectedSounds.length) parts.push(`sounds: ${selectedSounds.slice(0, 6).join(", ")}`);
  if (selectedRhythms.length) parts.push(`rhythm: ${selectedRhythms.slice(0, 4).join(", ")}`);
  const goal = String(idea).replace(/\s+/g, " ").trim().slice(0, 120);
  if (goal) parts.push(`goal: ${goal}`);
  const form = String(structure).replace(/\s+/g, " ").trim().slice(0, 90);
  if (form) parts.push(`sections: ${form}`);
  const r = String(rules).replace(/\n/g, " ").trim();
  /** 1000-cap one-liner: allow longer RULES so compact analyzer lines (≤260 each) survive before tail trim. */
  if (r) parts.push(`rules: ${r.slice(0, 300)}${r.length > 300 ? "…" : ""}`);
  if (voiceRef && vocal !== "Instrumental") {
    const vr = voiceRef.slice(0, 100);
    if (vr) parts.push(`vocal ref: ${vr}`);
  }
  parts.push(`mode: ${mode}`);

  return joinWithCap(parts, SUNO_STYLE_CHAR_CAP);
}

/**
 * **Final** Suno Lyrics field — priority-ordered (metadata first, lyric body last to drop).
 * Vocal tags and section brackets survive trimming longer than prose tails.
 */
export function buildSunoPastedLyricsField(p) {
  const vocal = p.vocal || "Instrumental";
  if (vocal === "Instrumental") {
    return "Instrumental only. No lyrical content.";
  }

  const parts = [];
  const theme = String(p.lyricTheme || "").replace(/\s+/g, " ").trim();
  const lang = String(p.lyricLanguage || "").replace(/\s+/g, " ").trim();
  const form = String(p.lyricStructure || "").replace(/\s+/g, " ").trim();
  const style = String(p.lyricStyle || "").replace(/\s+/g, " ").trim();
  const mode = String(p.lyricMode || "").replace(/\s+/g, " ").trim();
  const density =
    typeof p.lyricDensity === "number" && !Number.isNaN(p.lyricDensity)
      ? `density ${p.lyricDensity}%`
      : "";

  if (theme) parts.push(`theme: ${theme.slice(0, 140)}`);
  if (lang) parts.push(`language: ${lang.slice(0, 40)}`);
  if (form) parts.push(`sections: ${form.slice(0, 120)}`);
  if (style) parts.push(`lyric style: ${style.slice(0, 100)}`);
  if (mode) parts.push(`mode: ${mode.slice(0, 60)}`);
  if (density) parts.push(density);

  const body =
    String(p.generatedLyrics || "").trim() ||
    String(p.lyricPrompt || "").trim() ||
    buildSunoLyricsBoxPrompt({ vocal, lyricPrompt: p.lyricPrompt || "" });

  if (body && body !== "(Add lyric lines or bracketed sections.)") {
    parts.push(body);
  } else {
    parts.push("(Add lyric lines or bracketed sections.)");
  }

  return joinWithCap(parts, SUNO_LYRICS_CHAR_TYPICAL_MAX);
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
    return "Polish step: audio/image analyzers are optional — use Next whenever you’re ready to copy.";
  }
  return "Use the two copy blocks only — the Style line is 1000-safe and re-ordered for Suno (not the same as the walkthrough string above).";
}
