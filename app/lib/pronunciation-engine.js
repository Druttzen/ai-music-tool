/**
 * Pronunciation fixes for Suno lyrics — common problem words and names.
 */

const REPLACEMENTS = [
  [/queue/gi, "cue"],
  [/choir/gi, "quire"],
  [/thyme/gi, "time"],
  [/gnocchi/gi, "nyoh-kee"],
  [/sioux/gi, "soo"],
  [/receipt/gi, "re-seet"],
  [/wednesday/gi, "Wenz-day"],
  [/february/gi, "Feb-yoo-ary"],
];

/**
 * @param {string} lyrics
 */
export function fixSunoPronunciation(lyrics) {
  let out = String(lyrics || "");
  const fixes = [];

  for (const [re, sub] of REPLACEMENTS) {
    if (re.test(out)) {
      fixes.push({ pattern: re.source, replacement: sub });
      out = out.replace(re, sub);
    }
  }

  return { lyrics: out, fixes, changed: fixes.length > 0 };
}

/**
 * @param {string} word
 */
export function suggestPronunciationSpelling(word) {
  const w = String(word || "").trim();
  if (!w) return "";
  for (const [re, sub] of REPLACEMENTS) {
    if (re.test(w)) return sub;
  }
  return "";
}
