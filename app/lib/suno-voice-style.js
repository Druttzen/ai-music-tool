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
 * Style-field friendly line (single paragraph).
 */
export function buildSunoVoiceStyleLine({
  firstName,
  lastName,
  selectedGenres = [],
  moodWords = "",
}) {
  const name = formatPublicName(firstName, lastName);
  if (!name) return "";

  const genreHint =
    selectedGenres.length > 0
      ? selectedGenres.slice(0, 3).join(", ")
      : "the chosen genre";

  const moodHint = moodWords ? ` Mood: ${moodWords}.` : "";

  return (
    `Vocal direction (stylistic reference for Suno — not impersonation): ` +
    `aim for delivery energy, dynamics, and phrasing density in the spirit of recordings associated with ${name}; ` +
    `blend with ${genreHint}.${moodHint} ` +
    `Lead vocal: clear diction, genre-appropriate processing, intentional performance.`
  );
}

/**
 * Optional shorter line for tight Style boxes + lyric tag suggestion.
 */
export function buildSunoVoiceStyleCompact({ firstName, lastName, selectedGenres = [] }) {
  const name = formatPublicName(firstName, lastName);
  if (!name) return { style: "", lyricTag: "" };

  const g = selectedGenres[0] || "this style";
  const style = `${name}-inspired vocal energy (reference only), fit ${g}, natural mix`;
  const lyricTag = `[Vocal character: ${name}-like dynamics — stylistic reference only, not imitation]`;

  return { style, lyricTag };
}
