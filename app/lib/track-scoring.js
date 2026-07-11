/**
 * User track scoring (1–5 per dimension) → prompt and advisory hints.
 */

const HINTS = {
  bass: {
    low: "strong sub foundation, weighty low end",
    high: "controlled sub, tight bass balance",
  },
  rhythm: {
    low: "locked groove, punchy drum pocket, clear downbeats",
    high: "tight rhythmic pocket, consistent groove",
  },
  identity: {
    low: "distinct sonic signature, memorable timbre, genre clarity",
    high: "cohesive identity, recognizable palette",
  },
  clarity: {
    low: "clean mix, defined transients, separated elements",
    high: "polished mix clarity, balanced staging",
  },
};

const LOW_THRESHOLD = 3;

/**
 * @param {{ bass?: number, rhythm?: number, identity?: number, clarity?: number } | null | undefined} scores
 */
export function computeAvgScore(scores) {
  const s = scores || {};
  const vals = [s.bass, s.rhythm, s.identity, s.clarity].filter(
    (n) => typeof n === "number" && !Number.isNaN(n),
  );
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * @param {{ bass?: number, rhythm?: number, identity?: number, clarity?: number } | null | undefined} scores
 * @returns {string[]}
 */
export function scorePromptHints(scores) {
  const s = scores || {};
  const hints = [];
  for (const [key, copy] of Object.entries(HINTS)) {
    const val = Number(s[key]);
    if (!Number.isFinite(val)) continue;
    if (val <= LOW_THRESHOLD) hints.push(copy.low);
    else if (val >= 5) hints.push(copy.high);
  }
  return hints;
}

/**
 * @param {{ bass?: number, rhythm?: number, identity?: number, clarity?: number } | null | undefined} scores
 */
export function formatScoreSummary(scores) {
  const s = scores || {};
  const avg = computeAvgScore(s);
  if (!avg) return "";
  const weak = Object.entries(s)
    .filter(([, v]) => Number(v) <= LOW_THRESHOLD)
    .map(([k]) => k);
  const strong = Object.entries(s)
    .filter(([, v]) => Number(v) >= 5)
    .map(([k]) => k);
  const parts = [`track score ${avg.toFixed(1)}/5`];
  if (weak.length) parts.push(`boost ${weak.join(", ")}`);
  if (strong.length) parts.push(`strong ${strong.join(", ")}`);
  return parts.join("; ");
}

/**
 * @param {{ bass?: number, rhythm?: number, identity?: number, clarity?: number } | null | undefined} scores
 * @returns {string[]}
 */
export function scoreAdvisoryLines(scores) {
  const s = scores || {};
  const lines = [];
  if (Number(s.bass) <= LOW_THRESHOLD) {
    lines.push("Low-end score is weak — add sub weight, sidechain clarity, or a dedicated bass layer.");
  }
  if (Number(s.rhythm) <= LOW_THRESHOLD) {
    lines.push("Rhythm score is weak — tighten the groove anchor (4/4 or breakbeat) and drum transients.");
  }
  if (Number(s.identity) <= LOW_THRESHOLD) {
    lines.push("Identity score is weak — reduce genre sprawl and add one signature texture.");
  }
  if (Number(s.clarity) <= LOW_THRESHOLD) {
    lines.push("Clarity score is weak — shorten the sound list and emphasize mix separation in rules.");
  }
  return lines;
}
