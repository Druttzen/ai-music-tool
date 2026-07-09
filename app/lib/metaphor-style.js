/**
 * Lightweight 5-slot style metaphor generator (inspired by metaphor-machine, MIT).
 * Offline-safe — no external API.
 */

const GENRES = [
  "dark synthwave",
  "lo-fi hip-hop",
  "cinematic orchestral",
  "industrial techno",
  "dream pop",
  "phonk drift",
  "afrobeats pulse",
  "hyperpop chaos",
  "ambient drone",
  "neo-soul",
  "brazilian funk",
  "pluggnb haze",
  "rage trap",
  "darkwave pulse",
  "uk garage",
];

const VOCAL_TEXTURES = [
  "whispered mantras",
  "raspy close-mic lead",
  "layered harmonies",
  "spoken-word fragments",
  "breathy soprano",
  "detuned choir beds",
  "autotuned hooks",
  "intimate falsetto",
];

const INSTRUMENTS = [
  "spiraling analog synths",
  "tape-saturated Rhodes",
  "metallic percussion",
  "sub-heavy 808s",
  "jangly clean guitars",
  "orchestral string swells",
  "vinyl crackle pads",
  "distorted bass stabs",
];

const SPACES = [
  "neon-alley reverb",
  "dry bedroom intimacy",
  "stadium-wide chorus",
  "cathedral depth",
  "warehouse grit",
  "coastal haze",
  "midnight club pump",
];

const ARCS = [
  "dread crescendo",
  "euphoric lift",
  "melancholic fade",
  "tension release",
  "slow-burn bloom",
  "chaotic drop energy",
];

/** @param {() => number} [rng] */
function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

/**
 * @param {() => number} [rng]
 * @returns {{ slots: string[], styleLine: string }}
 */
export function generateMetaphorStyle(rng = Math.random) {
  const slots = [
    pick(GENRES, rng),
    pick(VOCAL_TEXTURES, rng),
    pick(INSTRUMENTS, rng),
    pick(SPACES, rng),
    pick(ARCS, rng),
  ];
  return {
    slots,
    styleLine: slots.join(", "),
  };
}

/**
 * Map metaphor slots to coarse Suno catalog picks.
 * @param {{ slots: string[] }} metaphor
 */
export function metaphorToCatalogHints(metaphor) {
  const line = metaphor.slots.join(" ").toLowerCase();
  const genres = [];
  if (/techno|industrial|phonk|garage|trap|rage|pluggnb/.test(line)) genres.push("Techno");
  if (/synthwave|hyperpop|dream pop|darkwave/.test(line)) genres.push("Synthwave");
  if (/lo-fi|neo-soul|hip-hop/.test(line)) genres.push("Lo-Fi Hip Hop");
  if (/orchestral|cinematic|choir/.test(line)) genres.push("Cinematic");
  if (/afrobeats|brazilian|funk/.test(line)) genres.push("Afrobeats");
  if (/ambient|drone/.test(line)) genres.push("Ambient");
  if (!genres.length) genres.push("Experimental");
  return { genres: [...new Set(genres)].slice(0, 3) };
}
