/**
 * Suno 5.5 lyrics metatag generator from structure + delivery hints.
 */

const DELIVERY_BY_MOOD = {
  dark: ["[Whispered]", "[Intimate]"],
  energetic: ["[Belted]", "[Powerful]"],
  calm: ["[Soft]", "[Breathy]"],
};

/**
 * @param {object} opts
 * @param {string} [opts.structure] — e.g. "intro → verse → chorus"
 * @param {string[]} [opts.moodWords]
 * @param {string} [opts.title]
 * @param {string} [opts.artist]
 */
export function generateSunoMetatagScaffold(opts = {}) {
  const structure = String(opts.structure || "intro → verse → chorus → verse → chorus → outro");
  const parts = structure.split(/→|->/).map((s) => s.trim().toLowerCase()).filter(Boolean);

  const delivery = pickDelivery(opts.moodWords || []);
  const lines = [];

  if (opts.title || opts.artist) {
    lines.push(
      `[Reference vibe: ${opts.artist || "reference"} — ${opts.title || "track"}; stylistic reference only]`,
    );
  }

  let verseN = 0;
  let chorusN = 0;
  for (const part of parts) {
    if (part.includes("intro")) {
      lines.push("[Intro]", "(instrumental build)", "");
    } else if (part.includes("verse")) {
      verseN += 1;
      lines.push(`[Verse ${verseN}]`, delivery[0] || "", "(lyrics here)", "");
    } else if (part.includes("pre-chorus") || part.includes("prechorus")) {
      lines.push("[Pre-Chorus]", "(lift here)", "");
    } else if (part.includes("chorus")) {
      chorusN += 1;
      lines.push(`[Chorus${chorusN > 1 ? ` ${chorusN}` : ""}]`, delivery[1] || delivery[0] || "[Belted]", "(hook here)", "");
    } else if (part.includes("bridge")) {
      lines.push("[Bridge]", "[Breakdown]", "(contrast here)", "");
    } else if (part.includes("outro")) {
      lines.push("[Outro]", "(fade)", "");
    }
  }

  return lines.join("\n").trim();
}

/**
 * @param {string[]} moodWords
 */
function pickDelivery(moodWords) {
  const lower = moodWords.map((m) => String(m).toLowerCase());
  if (lower.some((m) => m.includes("dark") || m.includes("sad"))) return DELIVERY_BY_MOOD.dark;
  if (lower.some((m) => m.includes("energy") || m.includes("aggress"))) return DELIVERY_BY_MOOD.energetic;
  if (lower.some((m) => m.includes("calm") || m.includes("soft"))) return DELIVERY_BY_MOOD.calm;
  return ["[Expressive]", "[Emotive]"];
}
