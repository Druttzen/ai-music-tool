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

/** Sticky `/g` regexes keep lastIndex across calls — always reset before test. */
function regexMatches(re, text) {
  re.lastIndex = 0;
  const hit = re.test(text);
  re.lastIndex = 0;
  return hit;
}

/**
 * @param {string} lyrics
 */
export function fixSunoPronunciation(lyrics) {
  let out = String(lyrics || "");
  const fixes = [];

  for (const [re, sub] of REPLACEMENTS) {
    const next = out.replace(re, sub);
    if (next !== out) {
      fixes.push({ pattern: re.source, replacement: sub });
      out = next;
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
    if (regexMatches(re, w)) return sub;
  }
  return "";
}
