/**
 * Suno-oriented vocal *style* lines using public artists as stylistic references.
 * Copy is phrased as stylistic direction only — not voice cloning or impersonation.
 *
 * Quick presets include MusicBrainz-sourced genre/gender seeds (public tags) so offline
 * generation still yields Suno 5.5 triple-stack tokens before any live lookup.
 */

/** @typedef {import("./voice-style-lookup").ArtistVoiceProfile} ArtistVoiceProfile */

/**
 * Quick-pick presets with authentic public metadata seeds (MusicBrainz genre/gender tags).
 * `profileSeed` mirrors live lookup shape for offline Suno 5.5 token generation.
 */
export const FAMOUS_VOICE_PRESETS = [
  {
    first: "Whitney",
    last: "Houston",
    searchName: "Whitney Houston",
    profileSeed: {
      displayName: "Whitney Houston",
      gender: "female",
      genres: ["soul", "pop", "r&b"],
      tags: ["power ballad", "gospel", "diva"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Freddie",
    last: "Mercury",
    searchName: "Freddie Mercury",
    profileSeed: {
      displayName: "Freddie Mercury",
      gender: "male",
      genres: ["rock", "glam rock", "pop rock"],
      tags: ["operatic", "theatrical", "arena rock"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Adele",
    last: "Adkins",
    searchName: "Adele",
    profileSeed: {
      displayName: "Adele",
      gender: "female",
      genres: ["soul", "pop", "british soul"],
      tags: ["powerful alto", "ballad"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Frank",
    last: "Sinatra",
    searchName: "Frank Sinatra",
    profileSeed: {
      displayName: "Frank Sinatra",
      gender: "male",
      genres: ["jazz", "swing", "traditional pop"],
      tags: ["crooner", "big band"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Beyoncé",
    last: "Knowles",
    searchName: "Beyoncé",
    profileSeed: {
      displayName: "Beyoncé",
      gender: "female",
      genres: ["r&b", "pop", "soul"],
      tags: ["powerful belt", "melisma"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Elvis",
    last: "Presley",
    searchName: "Elvis Presley",
    profileSeed: {
      displayName: "Elvis Presley",
      gender: "male",
      genres: ["rock and roll", "rockabilly", "pop"],
      tags: ["crooner", "southern rock"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Taylor",
    last: "Swift",
    searchName: "Taylor Swift",
    profileSeed: {
      displayName: "Taylor Swift",
      gender: "female",
      genres: ["pop", "country", "singer-songwriter"],
      tags: ["storytelling", "confessional"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Michael",
    last: "Jackson",
    searchName: "Michael Jackson",
    profileSeed: {
      displayName: "Michael Jackson",
      gender: "male",
      genres: ["pop", "soul", "funk"],
      tags: ["falsetto", "rhythmic pop"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "David",
    last: "Bowie",
    searchName: "David Bowie",
    profileSeed: {
      displayName: "David Bowie",
      gender: "male",
      genres: ["art rock", "glam rock", "pop rock"],
      tags: ["theatrical", "androgynous"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Billie",
    last: "Eilish",
    searchName: "Billie Eilish",
    profileSeed: {
      displayName: "Billie Eilish",
      gender: "female",
      genres: ["pop", "alternative pop", "electropop"],
      tags: ["breathy", "whispered", "intimate"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Prince",
    last: "",
    searchName: "Prince",
    profileSeed: {
      displayName: "Prince",
      gender: "male",
      genres: ["funk", "pop", "r&b"],
      tags: ["falsetto", "soul"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Aretha",
    last: "Franklin",
    searchName: "Aretha Franklin",
    profileSeed: {
      displayName: "Aretha Franklin",
      gender: "female",
      genres: ["soul", "gospel", "r&b"],
      tags: ["powerhouse", "gospel melisma"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "John",
    last: "Lennon",
    searchName: "John Lennon",
    profileSeed: {
      displayName: "John Lennon",
      gender: "male",
      genres: ["rock", "pop rock", "psychedelic rock"],
      tags: ["raw", "expressive"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Mariah",
    last: "Carey",
    searchName: "Mariah Carey",
    profileSeed: {
      displayName: "Mariah Carey",
      gender: "female",
      genres: ["pop", "r&b", "soul"],
      tags: ["soprano", "melisma", "whistle register"],
      sources: ["musicbrainz-seed"],
    },
  },
  {
    first: "Bob",
    last: "Dylan",
    searchName: "Bob Dylan",
    profileSeed: {
      displayName: "Bob Dylan",
      gender: "male",
      genres: ["folk", "folk rock", "singer-songwriter"],
      tags: ["nasal", "spoken-sung"],
      sources: ["musicbrainz-seed"],
    },
  },
];

export function formatPublicName(firstName, lastName) {
  const f = String(firstName || "").trim();
  const l = String(lastName || "").trim();
  if (!f) return "";
  if (!l) return f;
  return `${f} ${l}`;
}

/**
 * @param {typeof FAMOUS_VOICE_PRESETS[number]} preset
 * @returns {ArtistVoiceProfile}
 */
export function presetToVoiceProfile(preset) {
  const seed = preset?.profileSeed || {};
  return {
    id: "",
    displayName: seed.displayName || formatPublicName(preset.first, preset.last),
    sortName: seed.displayName || formatPublicName(preset.first, preset.last),
    gender: seed.gender || "",
    type: "person",
    country: "",
    tags: seed.tags || [],
    genres: seed.genres || [],
    spotifyGenres: [],
    wikipediaTitle: "",
    wikipediaDescription: "",
    wikipediaExtract: "",
    externalUrl: "",
    sources: seed.sources || ["preset-seed"],
  };
}

/**
 * Paste-ready Style-field line (comma-separated tokens, no disclaimers).
 * @deprecated Prefer buildSunoVoiceStyleFromProfile for Suno 5.5 triple-stack output.
 */
export function buildSunoVoiceStyleLine({
  firstName,
  lastName,
  selectedGenres = [],
  moodWords = "",
}) {
  const name = formatPublicName(firstName, lastName);
  if (!name) return "";

  const parts = [`${name}-inspired vocal energy`, "stylistic reference only"];
  if (selectedGenres.length) parts.push(...selectedGenres.slice(0, 3));
  if (moodWords) parts.push(...moodWords.split(/,\s*/).filter(Boolean));
  parts.push("clear diction", "genre-appropriate processing");
  return parts.join(", ");
}

/**
 * Optional shorter line for tight Style boxes + lyric tag suggestion.
 * @param {{ firstName?: string, lastName?: string, selectedGenres?: string[] }} opts
 */
export function buildSunoVoiceStyleCompact({ firstName, lastName, selectedGenres = [] }) {
  const name = formatPublicName(firstName, lastName);
  if (!name) return { style: "", lyricTag: "" };

  const g = selectedGenres[0] || "this style";
  const style = `${name}-inspired vocal energy (reference only), fit ${g}, natural mix`;
  const lyricTag = `[Vocal character: ${name}-like dynamics — stylistic reference only, not imitation]`;

  return { style, lyricTag };
}
