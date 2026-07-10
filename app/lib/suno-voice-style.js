/**
 * Suno-oriented vocal *style* lines using public artists’ names as references.
 * Copy is phrased as stylistic direction only — not voice cloning or impersonation.
 */

/** Quick-pick: first + last names (public figures). Last may be empty for mononyms. */
export const FAMOUS_VOICE_PRESETS = [
  { first: "Whitney", last: "Houston" },
  { first: "Freddie", last: "Mercury" },
  { first: "Adele", last: "Adkins" },
  { first: "Frank", last: "Sinatra" },
  { first: "Beyoncé", last: "Knowles" },
  { first: "Elvis", last: "Presley" },
  { first: "Taylor", last: "Swift" },
  { first: "Michael", last: "Jackson" },
  { first: "David", last: "Bowie" },
  { first: "Billie", last: "Eilish" },
  { first: "Prince", last: "" },
  { first: "Aretha", last: "Franklin" },
  { first: "John", last: "Lennon" },
  { first: "Mariah", last: "Carey" },
  { first: "Bob", last: "Dylan" },
];

export function formatPublicName(firstName, lastName) {
  const f = String(firstName || "").trim();
  const l = String(lastName || "").trim();
  if (!f) return "";
  if (!l) return f;
  return `${f} ${l}`;
}

/**
 * Paste-ready Style-field line (comma-separated tokens, no disclaimers).
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
