/**
 * My Taste profile — local Suno 5.5 L1 personalization from project history.
 */

/**
 * @param {{ history?: object[], current?: object|null, customPresets?: Record<string, object> }} sources
 */
export function collectProjectSnapshots(sources = {}) {
  const snaps = [];
  if (sources.current && typeof sources.current === "object") snaps.push(sources.current);
  for (const item of sources.history || []) {
    if (item?.state && typeof item.state === "object") snaps.push(item.state);
  }
  for (const preset of Object.values(sources.customPresets || {})) {
    if (preset && typeof preset === "object") snaps.push(preset);
  }
  return snaps;
}

/**
 * @param {{ history?: object[], current?: object|null, customPresets?: Record<string, object> }} sources
 */
export function buildMyTasteProfile(sources = {}) {
  const snapshots = collectProjectSnapshots(sources);
  const sampleCount = snapshots.length;

  if (!sampleCount) {
    return {
      sampleCount: 0,
      ready: false,
      topGenres: [],
      vocalLean: "",
      bpmBand: "",
      moodWords: [],
      moodAverages: null,
      magicStyleLine: "",
      tip: "Save prompts to history or work on a few projects to build your taste profile.",
    };
  }

  const genreCounts = countTags(snapshots.flatMap(snapshotGenres));
  const topGenres = topKeys(genreCounts, 3);

  const vocalCounts = countTags(snapshots.map((s) => s.vocal).filter(Boolean));
  const vocalLean = topKeys(vocalCounts, 1)[0] || "";

  const bpms = snapshots.map((s) => parseBpm(s.tempo)).filter((n) => n > 0);
  const avgBpm = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;
  const bpmSpread = bpms.length ? Math.max(...bpms) - Math.min(...bpms) : 0;
  const bpmBand = avgBpm ? `${avgBpm} BPM` : "";

  const moodAverages = averageMood(snapshots.map((s) => s.mood).filter(isMoodObject));
  const moodWords = moodAverages ? moodToWords(moodAverages) : [];

  const magicStyleLine = [
    topGenres.slice(0, 2).join(", "),
    bpmBand,
    vocalLean && !/instrumental/i.test(vocalLean) ? vocalLean : "",
    moodWords.slice(0, 2).join(", "),
    "polished studio mix",
    "no impersonation",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 980);

  return {
    sampleCount,
    ready: sampleCount >= 2,
    topGenres,
    vocalLean,
    bpmBand,
    bpmSpread,
    moodWords,
    moodAverages,
    magicStyleLine,
    tip:
      sampleCount >= 2
        ? "Local My Taste line from your project history — edit genres/tempo anytime."
        : "Add one more saved project to unlock a stronger taste profile.",
  };
}

/**
 * @param {object} state
 * @param {object[]} history
 */
export function trackSummariesFromWorkspace(state, history = []) {
  /** @type {object[]} */
  const out = [];
  const seen = new Set();

  const push = (snap, title) => {
    if (!snap || typeof snap !== "object") return;
    const t = String(title || snap.idea || "Untitled").trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push({
      title: t,
      artist: "You",
      bpm: snap.tempo || "",
      key: "",
      genres: snap.selectedGenres || [],
    });
  };

  push(state, state?.idea);
  for (const item of history) {
    push(item?.state, item?.label);
  }
  return out;
}

/**
 * @param {string|number} raw
 */
function parseBpm(raw) {
  if (typeof raw === "number") return raw;
  const m = String(raw || "").match(/(\d{2,3})/);
  return m ? Number(m[1]) : 0;
}

/**
 * @param {object} snapshot
 */
function snapshotGenres(snapshot) {
  return snapshot?.selectedGenres || snapshot?.genres || [];
}

/**
 * @param {string[]} tags
 */
function countTags(tags) {
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, string>} */
  const labels = {};
  for (const t of tags) {
    const k = String(t || "").trim();
    if (!k) continue;
    const key = k.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    if (!labels[key]) labels[key] = k;
  }
  return { counts, labels };
}

/**
 * @param {{ counts: Record<string, number>, labels: Record<string, string> }} counted
 * @param {number} n
 */
function topKeys(counted, n) {
  return Object.entries(counted.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => counted.labels[k]);
}

/**
 * @param {unknown} m
 */
function isMoodObject(m) {
  return m && typeof m === "object" && "energy" in m;
}

/**
 * @param {object[]} moods
 */
function averageMood(moods) {
  if (!moods.length) return null;
  const keys = ["darkness", "energy", "aggression", "emotion", "complexity", "space"];
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of keys) {
    const vals = moods.map((m) => Number(m[key])).filter((n) => Number.isFinite(n));
    out[key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  }
  return out;
}

/**
 * @param {Record<string, number>} mood
 */
function moodToWords(mood) {
  const words = [];
  if (mood.energy >= 65) words.push("high energy");
  else if (mood.energy <= 40) words.push("laid-back");
  if (mood.darkness >= 65) words.push("dark");
  else if (mood.darkness <= 35) words.push("bright");
  if (mood.emotion >= 60) words.push("emotive");
  if (mood.aggression >= 65) words.push("aggressive edge");
  if (mood.space >= 60) words.push("spacious");
  if (mood.complexity >= 60) words.push("intricate");
  return words.length ? words : ["balanced"];
}
