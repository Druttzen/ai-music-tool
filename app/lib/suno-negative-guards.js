/**
 * Curated negative-style guard packs (v5.5 community guidance).
 * Use in RULES / NO-GO export — max 2–3 exclusions per track recommended.
 */

export const NEGATIVE_GUARD_PACKS = {
  instrumental: ["no vocals", "no choir", "no oohs/ahhs", "no spoken words"],
  introVocal: ["no hum", "no la la vocals", "no ambient intro vocals", "no wordless intro"],
  mixClean: ["no excessive reverb", "no lo-fi mush", "no generic EDM defaults"],
  guitarOnly: ["no drums", "no percussion", "no bass"],
  vocalChops: ["no vocal chops", "no mumbled speech", "no ad-lib clutter"],
  preserveVocal: ["no singer change", "no altered vocal delivery", "no new backing vocals"],
  preserveInstrumentation: ["no added instruments", "no replaced sounds", "no new musical layers"],
  shortIntro: ["no long ambient intro", "no delayed first section", "no unnecessary opening effects"],
  cymbalControl: ["no excessive cymbal wash", "no brittle hi-hats", "no constant crash layer"],
  lowMidClean: ["no muddy low mids", "no boomy resonance", "no masked vocal range"],
  stereoSafe: ["no exaggerated stereo widening", "no stereo sub-bass", "no phasey imaging"],
  stableStyle: ["no abrupt genre switching", "no unexpected tempo change", "no unnecessary key change"],
  dynamicMaster: ["no over-compressed master", "no flattened transients", "no audible limiter pumping"],
};

/** @type {Record<string, string[]>} */
export const NEGATIVE_GUARD_ALIASES = {
  instrumental: "instrumental",
  "instrumental only": "instrumental",
  "no vocals": "instrumental",
  "guitar only": "guitarOnly",
  "guitar and voice": "guitarOnly",
  "clean mix": "mixClean",
  "no intro hum": "introVocal",
  "preserve vocal": "preserveVocal",
  "same singer": "preserveVocal",
  "no added instruments": "preserveInstrumentation",
  "short intro": "shortIntro",
  "no cymbal wash": "cymbalControl",
  "clean low mids": "lowMidClean",
  "mono compatible": "stereoSafe",
  "no genre switching": "stableStyle",
  "dynamic master": "dynamicMaster",
};

/**
 * @param {string} [packId]
 * @returns {string[]}
 */
export function getNegativeGuardPack(packId) {
  return [...(NEGATIVE_GUARD_PACKS[packId] || [])];
}

/**
 * @param {object} opts
 * @param {string} [opts.vocal]
 * @param {string} [opts.rules]
 * @param {string[]} [opts.extraPacks]
 * @param {number} [opts.max]
 */
export function selectNegativeGuards({ vocal, rules = "", extraPacks = [], max = 3 } = {}) {
  const chosen = [];
  const seen = new Set();
  const add = (phrase) => {
    const key = String(phrase || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    chosen.push(phrase);
  };

  if (vocal === "Instrumental") {
    for (const p of NEGATIVE_GUARD_PACKS.instrumental) add(p);
  }

  const lowerRules = String(rules || "").toLowerCase();
  for (const [needle, packId] of Object.entries(NEGATIVE_GUARD_ALIASES)) {
    if (lowerRules.includes(needle)) {
      for (const p of getNegativeGuardPack(packId)) add(p);
    }
  }

  for (const packId of extraPacks) {
    for (const p of getNegativeGuardPack(packId)) add(p);
  }

  if (lowerRules.includes("no intro") || lowerRules.includes("start on lyrics")) {
    for (const p of NEGATIVE_GUARD_PACKS.introVocal) add(p);
  }

  return chosen.slice(0, max);
}

/** Instrumental lyric scaffold with v5.5 dual guard tags. */
export const INSTRUMENTAL_LYRICS_SCAFFOLD = "[Instrumental]\n[Instrumental Break]\n[No Vocals]\n[End]";
