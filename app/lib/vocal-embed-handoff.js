/**
 * Multi-file vocal embed handoff export (no zip dependency).
 */

import { safeLocalStorage } from "./safe-local-storage";

export const VOCAL_ALIGN_PREVIEW_STORAGE_KEY = "ai_music_creator_vocal_align_preview";

/** @returns {{ instrumentalName?: string, guideName?: string, preview?: object }|null} */
export function readStoredVocalAlignPreview() {
  return safeLocalStorage.getJSON(VOCAL_ALIGN_PREVIEW_STORAGE_KEY, null);
}

/** @param {{ instrumentalName?: string, guideName?: string, preview: object }|null} session */
export function writeStoredVocalAlignPreview(session) {
  if (!session?.preview) {
    safeLocalStorage.remove(VOCAL_ALIGN_PREVIEW_STORAGE_KEY);
    return;
  }
  safeLocalStorage.setJSON(VOCAL_ALIGN_PREVIEW_STORAGE_KEY, session);
}

/**
 * @param {object|null} alignPreview
 * @param {string} [instrumentalName]
 * @param {string} [guideName]
 */
export function buildVocalEmbedBundleSession(alignPreview, instrumentalName = "", guideName = "") {
  if (!alignPreview) return null;
  return {
    instrumentalName,
    guideName,
    preview: alignPreview,
    alignMethod: alignPreview.align_method || null,
    wordCount: alignPreview.word_count ?? null,
  };
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {object} opts
 * @param {object} opts.planEnvelope
 * @param {Blob|null} [opts.instrumental]
 * @param {string} [opts.instrumentalName]
 * @param {Blob|null} [opts.guideVocal]
 * @param {string} [opts.guideName]
 * @param {object|null} [opts.alignPreview]
 */
export async function exportVocalEmbedHandoffPack({
  planEnvelope,
  instrumental = null,
  instrumentalName = "instrumental.wav",
  guideVocal = null,
  guideName = "guide-vocal.wav",
  alignPreview = null,
}) {
  const stamp = Date.now();
  const base = `vocal-embed-handoff-${stamp}`;
  triggerDownload(
    new Blob([JSON.stringify(planEnvelope, null, 2)], { type: "application/json" }),
    `${base}-plan.json`,
  );
  const readme = [
    "Vocal Embed handoff pack",
    "========================",
    "",
    "Files:",
    `- ${base}-plan.json — sidecar-ready vocal embed plan`,
    instrumental ? `- ${base}-instrumental.wav` : "(re-export instrumental from analyzer if missing)",
    guideVocal ? `- ${base}-guide-vocal.wav` : "(no guide vocal attached)",
    alignPreview
      ? `- ${base}-align-preview.json — MFA/heuristic word alignment (${alignPreview.align_method || "?"})`
      : "(run Align preview in the app for timing JSON)",
    "",
    "Next steps:",
    "1. npm run sidecar (and sidecar:vocal-ml if using RVC/DiffSinger)",
    "2. POST plan to /vocal-embed/plan or use Synthesize in the app",
    "3. Configure MFA via ai-sidecar/.env.vocal for tighter lyric timing",
  ].join("\n");
  triggerDownload(new Blob([readme], { type: "text/plain" }), `${base}-README.txt`);
  if (alignPreview) {
    triggerDownload(
      new Blob([JSON.stringify(alignPreview, null, 2)], { type: "application/json" }),
      `${base}-align-preview.json`,
    );
    await new Promise((r) => setTimeout(r, 120));
  }
  if (instrumental) {
    await new Promise((r) => setTimeout(r, 120));
    triggerDownload(instrumental, `${base}-instrumental.wav`);
  }
  if (guideVocal) {
    await new Promise((r) => setTimeout(r, 120));
    triggerDownload(guideVocal, `${base}-guide-vocal.wav`);
  }
}
