/**
 * Suno field limits for this tool.
 * Conservative local copy budgets. These are not verified v6 platform limits.
 */

/** App copy budget retained for compatibility with existing projects. */
export const SUNO_STYLE_CHAR_CAP = 1000;

/** Warn when approaching the Style cap so users can trim before truncation. */
export const SUNO_STYLE_CHAR_WARN = 900;

/** Lyrics field cap varies less predictably across builds; typical upper bound ~5000 (not confirmed like Style). */
export const SUNO_LYRICS_CHAR_TYPICAL_MAX = 5000;
export const SUNO_LYRICS_CHAR_WARN = 4800;

export const SUNO_LIMITS_PRINCIPLE =
  "Keep the musical identity clear: genre, vocal role, tempo, instruments and arrangement. This app uses a 1000-character Style copy budget; Suno v6 platform limits should be checked in its current form.";

export const SUNO_LIMITS_NOTE =
  "Local copy budgets: Style 1000, Lyrics 5000 characters. Official v6 hard limits are unconfirmed; check the current Suno form.";

/**
 * @param {number} styleLen - Suno “Style of Music” paste length (sound-focused block).
 * @param {number} lyricsLen - Suno “Lyrics” paste length (words + bracket tags).
 * @returns {string[]} Human-readable warnings (empty if OK).
 */
export function validateSunoFieldLengths(styleLen, lyricsLen) {
  const w = [];

  if (styleLen > SUNO_STYLE_CHAR_CAP) {
    w.push(
      `Style box is ${styleLen} characters — over this app's ${SUNO_STYLE_CHAR_CAP}-character copy budget. Shorten the brief while preserving the main musical direction.`,
    );
  } else if (styleLen > SUNO_STYLE_CHAR_WARN) {
    w.push(
      `Style box is ${styleLen}/${SUNO_STYLE_CHAR_CAP} characters — close to this app's copy budget; prioritize the main musical direction.`,
    );
  }

  if (lyricsLen > SUNO_LYRICS_CHAR_TYPICAL_MAX) {
    w.push(
      `Lyrics direction is ${lyricsLen} characters — over this app's ${SUNO_LYRICS_CHAR_TYPICAL_MAX}-character copy budget. Reduce section notes or split into another pass.`,
    );
  } else if (lyricsLen > SUNO_LYRICS_CHAR_WARN) {
    w.push(
      `Lyrics direction is ${lyricsLen}/${SUNO_LYRICS_CHAR_TYPICAL_MAX} characters — close to this app's copy budget.`,
    );
  }

  return w;
}
