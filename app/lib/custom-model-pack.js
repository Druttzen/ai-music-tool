/**
 * Suno 5.5 Custom Model pack — checklist from project/bundle history.
 */

/**
 * @param {object[]} trackSummaries — { title, artist, bpm, key, genres, source }
 * @param {{ minTracks?: number }} [opts]
 */
export function buildCustomModelPack(trackSummaries, opts = {}) {
  const minTracks = opts.minTracks ?? 6;
  const tracks = Array.isArray(trackSummaries) ? trackSummaries.filter((t) => t?.title) : [];

  const bpms = tracks.map((t) => parseBpm(t.bpm)).filter((n) => n > 0);
  const genres = tracks.flatMap((t) => t.genres || []);
  const genreCounts = countTags(genres);
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g]) => g);

  const bpmSpread = bpms.length ? Math.max(...bpms) - Math.min(...bpms) : 0;
  const cohesive = bpmSpread <= 25 && topGenres.length <= 3;

  const soundBible = [
    topGenres.slice(0, 2).join(" + ") || "your core genre",
    bpms.length ? `${Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)} BPM avg groove` : "",
    cohesive ? "stylistically consistent catalog" : "mixed styles — consider separate Custom Models per genre",
    "original owned recordings only",
  ].filter(Boolean);

  return {
    trackCount: tracks.length,
    minTracks,
    ready: tracks.length >= minTracks,
    cohesive,
    bpmSpread,
    topGenres,
    soundBible: soundBible.join(", "),
    checklist: [
      { ok: tracks.length >= minTracks, label: `${tracks.length}/${minTracks} tracks selected` },
      { ok: cohesive, label: cohesive ? "Genre/BPM cohesion good" : "Wide style spread — split models?" },
      { ok: true, label: "Confirm you own rights to all uploads" },
    ],
    tracks: tracks.slice(0, 12),
    uploadTip: "Use Suno Custom Model bulk upload with stylistically similar originals — avoid genre mashups in one model.",
  };
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
 * @param {string[]} tags
 */
function countTags(tags) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const t of tags) {
    const k = String(t || "").trim().toLowerCase();
    if (!k) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
