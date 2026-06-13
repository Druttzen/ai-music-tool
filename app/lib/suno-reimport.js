/**
 * Suno re-import loop — compare pasted Suno Style/Lyrics vs project-built paste fields.
 */

import { SUNO_LYRICS_CHAR_TYPICAL_MAX, SUNO_STYLE_CHAR_CAP } from "./suno-limits";

/**
 * @param {unknown} text
 */
export function normalizePasteLine(text) {
  return String(text || "").replace(/\r\n/g, "\n").trim();
}

/**
 * @param {unknown} text
 */
export function capPasteStyle(text) {
  return normalizePasteLine(text).slice(0, SUNO_STYLE_CHAR_CAP);
}

/**
 * @param {unknown} text
 */
export function capPasteLyrics(text) {
  return normalizePasteLine(text).slice(0, SUNO_LYRICS_CHAR_TYPICAL_MAX);
}

/**
 * @param {{ projectStyle?: string, projectLyrics?: string, pastedStyle?: string, pastedLyrics?: string }} input
 */
export function buildSunoPasteDiff(input) {
  /** @type {Array<{ id: string, label: string, project: string, pasted: string, changed: boolean, summary: string }>} */
  const sections = [];

  const projectStyle = normalizePasteLine(input.projectStyle);
  const projectLyrics = normalizePasteLine(input.projectLyrics);
  const pastedStyle = normalizePasteLine(input.pastedStyle);
  const pastedLyrics = normalizePasteLine(input.pastedLyrics);

  if (pastedStyle || projectStyle) {
    const changed = projectStyle !== pastedStyle;
    sections.push({
      id: "style",
      label: "Style",
      project: projectStyle,
      pasted: pastedStyle,
      changed,
      summary: !pastedStyle
        ? "No pasted Style yet"
        : changed
          ? "Pasted Style differs from project-built paste"
          : "Pasted Style matches project-built paste",
    });
  }

  if (pastedLyrics || projectLyrics) {
    const changed = projectLyrics !== pastedLyrics;
    sections.push({
      id: "lyrics",
      label: "Lyrics",
      project: projectLyrics,
      pasted: pastedLyrics,
      changed,
      summary: !pastedLyrics
        ? "No pasted Lyrics yet"
        : changed
          ? "Pasted Lyrics differs from project-built paste"
          : "Pasted Lyrics matches project-built paste",
    });
  }

  return sections;
}

/**
 * @param {{ pastedStyle?: string, pastedLyrics?: string }} input
 */
export function hasSunoPasteContent(input) {
  return Boolean(normalizePasteLine(input.pastedStyle) || normalizePasteLine(input.pastedLyrics));
}

/**
 * When active, preview/copy uses pasted Suno fields instead of project-built slices.
 * @param {{ style: string, lyrics: string }} built
 * @param {{ sunoPasteActive?: boolean, sunoPasteStyle?: string, sunoPasteLyrics?: string }} input
 */
export function applySunoPasteToSlices(built, input) {
  if (!input.sunoPasteActive) return built;

  const next = { ...built };
  const style = normalizePasteLine(input.sunoPasteStyle);
  const lyrics = normalizePasteLine(input.sunoPasteLyrics);

  if (style) next.style = capPasteStyle(style);
  if (lyrics) next.lyrics = capPasteLyrics(lyrics);
  return next;
}

/**
 * Extract plain lyric body from bracketed Suno Lyrics paste (best-effort).
 * @param {unknown} pastedLyrics
 */
export function extractLyricsBodyFromPaste(pastedLyrics) {
  const raw = normalizePasteLine(pastedLyrics);
  if (!raw) return "";

  const bracketMatch = raw.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (bracketMatch) return bracketMatch[2].trim();

  return raw;
}
