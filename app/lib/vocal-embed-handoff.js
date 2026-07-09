/**
 * Multi-file vocal embed handoff export (no zip dependency).
 */

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
 */
export async function exportVocalEmbedHandoffPack({
  planEnvelope,
  instrumental = null,
  instrumentalName = "instrumental.wav",
  guideVocal = null,
  guideName = "guide-vocal.wav",
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
    "",
    "Next steps:",
    "1. npm run sidecar (and sidecar:vocal-ml if using RVC/DiffSinger)",
    "2. POST plan to /vocal-embed/plan or use Synthesize in the app",
    "3. Configure MFA via ai-sidecar/.env.vocal for tighter lyric timing",
  ].join("\n");
  triggerDownload(new Blob([readme], { type: "text/plain" }), `${base}-README.txt`);
  if (instrumental) {
    await new Promise((r) => setTimeout(r, 120));
    triggerDownload(instrumental, `${base}-instrumental.wav`);
  }
  if (guideVocal) {
    await new Promise((r) => setTimeout(r, 120));
    triggerDownload(guideVocal, `${base}-guide-vocal.wav`);
  }
}
