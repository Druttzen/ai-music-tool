/**
 * Slice an audio blob to the analyzer highlight range for MusicGen melody reference.
 */

import { audioBufferToWavBlob } from "./audio-enhancer";
import { sliceAudioBuffer } from "./audio-buffer-serialize";

/**
 * @param {Blob} blob
 * @param {number} startSec
 * @param {number} endSec
 * @param {string} [fileName]
 */
export async function sliceAudioBlobToHighlightRange(blob, startSec, endSec, fileName = "highlight-melody.wav") {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const duration = buffer.duration || 0;
    const start = Math.max(0, Math.min(startSec, duration));
    const end = Math.max(start + 0.25, Math.min(endSec, duration));
    const sliced = sliceAudioBuffer(buffer, start, end);
    const wav = audioBufferToWavBlob(sliced);
    return new File([wav], fileName, { type: "audio/wav" });
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * @param {{ duration?: number, highlightStart?: number, highlightEnd?: number }} analysis
 */
export function hasMeaningfulHighlightRange(analysis) {
  const duration = Number(analysis?.duration) || 0;
  if (duration < 1) return false;
  const start = Number(analysis?.highlightStart) || 0;
  const end = Number(analysis?.highlightEnd) || duration;
  const span = Math.max(0, end - start);
  return span > 0.5 && span < duration * 0.92;
}
