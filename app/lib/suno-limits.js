/**
 * Suno field limits for this tool.
 * Style (“Style of Music”) cap: 1000 characters — confirmed in Suno chat for current product behaviour.
 */

/** Hard cap for the Style field (characters). Confirmed in Suno chat — treat as authoritative for this app. */
export const SUNO_STYLE_CHAR_CAP = 1000;

/** Warn when approaching the Style cap so users can trim before truncation. */
export const SUNO_STYLE_CHAR_WARN = 900;

/** Lyrics field cap varies less predictably across builds; typical upper bound ~5000 (not confirmed like Style). */
export const SUNO_LYRICS_CHAR_TYPICAL_MAX = 5000;
export const SUNO_LYRICS_CHAR_WARN = 4800;

export const SUNO_LIMITS_PRINCIPLE =
  "Suno Style field is limited to 1000 characters (confirmed). Put genre, vocal role, BPM, and strongest mood tokens first — overflow truncates silently. Lyrics field limits may differ by version.";

export const SUNO_LIMITS_NOTE =
  "Style cap 1000 characters confirmed in Suno chat. Lyrics/title caps are typical ranges — verify in-app if outputs clip.";

/**
 * @param {number} styleLen - Suno “Style of Music” paste length (sound-focused block).
 * @param {number} lyricsLen - Suno “Lyrics” paste length (words + bracket tags).
 * @returns {string[]} Human-readable warnings (empty if OK).
 */
export function validateSunoFieldLengths(styleLen, lyricsLen) {
  const w = [];

  if (styleLen > SUNO_STYLE_CHAR_CAP) {
    w.push(
      `Style box is ${styleLen} characters — over the ${SUNO_STYLE_CHAR_CAP}-character Suno Style limit (confirmed). Extra text may be cut — shorten or move detail to Lyrics; strongest tokens must come first.`,
    );
  } else if (styleLen > SUNO_STYLE_CHAR_WARN) {
    w.push(
      `Style box is ${styleLen}/${SUNO_STYLE_CHAR_CAP} characters — close to the ${SUNO_STYLE_CHAR_CAP}-character limit; prioritize opening lines.`,
    );
  }

  if (lyricsLen > SUNO_LYRICS_CHAR_TYPICAL_MAX) {
    w.push(
      `Lyrics direction is ${lyricsLen} characters (often ~${SUNO_LYRICS_CHAR_TYPICAL_MAX} max on newer models). Reduce section notes or split into another pass — tail may drop silently.`,
    );
  } else if (lyricsLen > SUNO_LYRICS_CHAR_WARN) {
    w.push(
      `Lyrics direction is ${lyricsLen}/${SUNO_LYRICS_CHAR_TYPICAL_MAX} characters — close to the usual ceiling.`,
    );
  }

  return w;
}
