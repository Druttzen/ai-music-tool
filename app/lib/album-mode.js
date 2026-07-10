/**
 * Album mode — cohesive multi-track Suno project sequences.
 */

/**
 * @param {object} soundBible — shared genres, tempo, vocal, production
 * @param {object[]} trackRoles — { role, title, idea }
 */
export function buildAlbumSequence(soundBible, trackRoles) {
  const roles = Array.isArray(trackRoles) ? trackRoles : [];
  const bible = soundBible || {};

  return roles.map((track, index) => {
    const role = track.role || inferRole(index, roles.length);
    const idea = String(track.idea || "").trim();
    const styleBase = [
      ...(bible.genres || []).slice(0, 2),
      bible.tempo || "",
      bible.key || "",
      bible.vocal || "",
      idea,
      bible.production || "cohesive album mix",
      roleAccent(role),
      "album continuity",
      "no impersonation",
    ].filter(Boolean);

    return {
      index: index + 1,
      role,
      title: track.title || `Track ${index + 1}`,
      idea: track.idea || "",
      styleLine: styleBase.join(", ").slice(0, 980),
      lyricsMetatag: `[Album track ${index + 1}: ${role}]`,
      sharedBible: compactBible(bible),
    };
  });
}

/**
 * @param {number} index
 * @param {number} total
 */
function inferRole(index, total) {
  if (index === 0) return "opener";
  if (index === total - 1) return "closer";
  if (index === Math.floor(total / 2)) return "single";
  if (index % 3 === 2) return "interlude";
  return "album cut";
}

/**
 * @param {string} role
 */
function roleAccent(role) {
  const map = {
    opener: "energetic album opener",
    single: "hook-forward single energy",
    interlude: "short transitional texture",
    closer: "reflective album closer",
    "album cut": "deep cut album depth",
  };
  return map[role] || "album cut";
}

/**
 * @param {object} bible
 */
function compactBible(bible) {
  return {
    genres: bible.genres || [],
    tempo: bible.tempo || "",
    vocal: bible.vocal || "",
    production: bible.production || "",
    key: bible.key || "",
  };
}

/**
 * @param {object} projectState
 */
export function soundBibleFromProject(projectState) {
  const p = projectState || {};
  return {
    genres: p.selectedGenres || p.genres || [],
    tempo: p.tempo || "",
    vocal: p.vocal || "",
    production: p.rules?.split("\n")[0] || "",
    key: p.audioAnalysis?.estimatedKey || p.estimatedKey || "",
  };
}
