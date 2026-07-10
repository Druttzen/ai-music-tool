/**
 * Map online artist metadata (MusicBrainz, Wikipedia, Spotify) to Suno 5.5 vocal
 * triple-stack tokens: Character + Delivery + Effects — not celebrity impersonation.
 */

import { uniq } from "./music-helpers";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

const VOCAL_KEYWORD_RULES = [
  { re: /\b(countertenor|falsetto)\b/i, character: "high male falsetto", delivery: "soaring upper register" },
  { re: /\b(tenor)\b/i, character: "male tenor", delivery: "lyrical upper-mid delivery" },
  { re: /\b(baritone)\b/i, character: "warm baritone", delivery: "rounded chest voice" },
  { re: /\b(bass voice|bass-baritone)\b/i, character: "deep bass-baritone", delivery: "low resonant delivery" },
  { re: /\b(soprano)\b/i, character: "bright soprano", delivery: "soaring top register" },
  { re: /\b(mezzo|alto)\b/i, character: "rich female alto", delivery: "mid-register warmth" },
  { re: /\b(operatic|opera)\b/i, delivery: "theatrical operatic projection", effects: "hall reverb tail" },
  { re: /\b(croon|crooner)\b/i, character: "smooth crooner", delivery: "intimate mic technique" },
  { re: /\b(whisper|breathy|asmr)\b/i, character: "breathy close-mic vocal", delivery: "whispered intimate phrasing" },
  { re: /\b(belt|belting|powerhouse)\b/i, delivery: "powerful belted chorus" },
  { re: /\b(melisma|melismatic|runs|riffs)\b/i, delivery: "melismatic vocal runs" },
  { re: /\b(raspy|gravelly|husky)\b/i, character: "raspy textured vocal" },
  { re: /\b(soul|gospel)\b/i, delivery: "soulful gospel inflection" },
  { re: /\b(jazz|swing)\b/i, delivery: "swing phrasing behind the beat" },
  { re: /\b(rap|hip hop|hip-hop)\b/i, delivery: "rhythmic rap cadence" },
  { re: /\b(folk|americana)\b/i, delivery: "storytelling folk phrasing" },
  { re: /\b(country)\b/i, delivery: "country drawl articulation" },
  { re: /\b(punk|hardcore)\b/i, delivery: "shouted aggressive delivery" },
  { re: /\b(metal|hard rock)\b/i, delivery: "gritty rock projection" },
  { re: /\b(electronic|synth)\b/i, effects: "treated vocal layers" },
];

const GENRE_VOCAL_RULES = [
  { tags: ["soul", "gospel", "neo soul"], character: "soulful lead vocal", delivery: "gospel-tinged melisma" },
  { tags: ["r&b", "rnb", "contemporary r&b"], character: "smooth R&B vocal", delivery: "melismatic phrasing" },
  { tags: ["jazz", "swing", "vocal jazz"], character: "jazz vocal tone", delivery: "laid-back swing phrasing" },
  { tags: ["pop", "dance pop", "synthpop"], character: "polished pop vocal", delivery: "radio-ready clarity" },
  { tags: ["rock", "hard rock", "arena rock", "glam rock"], character: "rock lead vocal", delivery: "anthemic projection" },
  { tags: ["folk", "singer-songwriter", "acoustic"], character: "organic folk vocal", delivery: "conversational storytelling" },
  { tags: ["country", "country pop"], character: "country lead vocal", delivery: "nasal twang phrasing" },
  { tags: ["hip hop", "rap"], character: "rap vocal", delivery: "rhythmic spoken flow" },
  { tags: ["metal", "heavy metal"], character: "aggressive rock vocal", delivery: "gritty shouted edges" },
  { tags: ["electronic", "house", "techno"], effects: "filtered vocal chops" },
  { tags: ["alternative", "indie", "art pop"], character: "alternative vocal", delivery: "intimate indie phrasing" },
  { tags: ["funk", "disco"], character: "funky lead vocal", delivery: "syncopated rhythmic delivery" },
  { tags: ["blues", "blues rock"], character: "bluesy vocal", delivery: "expressive blue notes" },
  { tags: ["opera", "classical"], delivery: "classical projection", effects: "concert hall reverb" },
];

const DEFAULT_EFFECTS = "dry close-mic, genre-appropriate mix";

/**
 * @param {string} gender
 */
export function genderToVocalCharacter(gender) {
  const g = String(gender || "").toLowerCase();
  if (g === "female") return "female lead vocal";
  if (g === "male") return "male lead vocal";
  return "lead vocal";
}

/**
 * @param {string[]} tags
 */
function normalizeTags(tags) {
  return uniq(
    (tags || [])
      .map((t) => String(t || "").toLowerCase().trim())
      .filter(Boolean),
  );
}

/**
 * @param {string[]} tags
 * @param {string} haystack
 */
function inferFromGenreTags(tags, haystack = "") {
  const normalized = normalizeTags(tags);
  const blob = `${normalized.join(" ")} ${haystack}`.toLowerCase();
  /** @type {string[]} */
  const characters = [];
  /** @type {string[]} */
  const deliveries = [];
  /** @type {string[]} */
  const effects = [];

  for (const rule of GENRE_VOCAL_RULES) {
    if (rule.tags.some((tag) => normalized.some((t) => t.includes(tag) || tag.includes(t)))) {
      if (rule.character) characters.push(rule.character);
      if (rule.delivery) deliveries.push(rule.delivery);
      if (rule.effects) effects.push(rule.effects);
    }
  }

  for (const rule of VOCAL_KEYWORD_RULES) {
    if (rule.re.test(blob)) {
      if (rule.character) characters.push(rule.character);
      if (rule.delivery) deliveries.push(rule.delivery);
      if (rule.effects) effects.push(rule.effects);
    }
  }

  return {
    characters: uniq(characters),
    deliveries: uniq(deliveries),
    effects: uniq(effects),
  };
}

/**
 * @param {import("./voice-style-lookup").ArtistVoiceProfile} profile
 * @param {{ selectedGenres?: string[], referenceName?: string }} [ctx]
 */
export function buildSunoVoiceStyleFromProfile(profile, ctx = {}) {
  const referenceName = String(ctx.referenceName || profile.displayName || "").trim();
  const genres = uniq([
    ...(profile.genres || []),
    ...(profile.tags || []),
    ...(profile.spotifyGenres || []),
    ...(ctx.selectedGenres || []),
  ]);

  const wikiHaystack = `${profile.wikipediaExtract || ""} ${profile.wikipediaDescription || ""}`;
  const inferred = inferFromGenreTags(genres, wikiHaystack);

  const character =
    inferred.characters[0] ||
    genderToVocalCharacter(profile.gender) ||
    "expressive lead vocal";
  const delivery =
    inferred.deliveries[0] ||
    (genres.some((g) => /pop|rock|soul/.test(g)) ? "emotive studio delivery" : "natural phrasing");
  const effects = inferred.effects[0] || DEFAULT_EFFECTS;

  const genreHint = ctx.selectedGenres?.[0] || genres[0] || "track";
  const styleParts = uniq([
    character,
    delivery,
    effects,
    genres.slice(0, 2).join(" "),
    `fit ${genreHint}`,
    "clear diction",
    "no impersonation",
  ]).filter(Boolean);

  let style = styleParts.join(", ");
  if (style.length > SUNO_STYLE_CHAR_CAP) {
    style = style.slice(0, SUNO_STYLE_CHAR_CAP - 1) + "…";
  }

  const traitSummary = uniq([character, delivery, effects, ...genres.slice(0, 3)]).join(", ");
  const lyricTag = referenceName
    ? `[Vocal character: ${referenceName}-inspired ${traitSummary.slice(0, 140)} — stylistic reference only]`
    : `[Vocal character: ${traitSummary.slice(0, 160)} — stylistic reference only]`;

  return {
    style,
    lyricTag,
    voiceStyleLine: style,
    traitSummary,
    sources: profile.sources || [],
    profile,
  };
}

/**
 * @param {import("./voice-style-lookup").ArtistVoiceProfile} profile
 */
export function summarizeArtistVoiceProfile(profile) {
  const genres = uniq([...(profile.genres || []), ...(profile.tags || []), ...(profile.spotifyGenres || [])]);
  const bits = [
    profile.displayName,
    profile.gender ? `${profile.gender} artist` : "",
    genres.slice(0, 4).join(", "),
    profile.country || "",
  ].filter(Boolean);
  return bits.join(" · ");
}
