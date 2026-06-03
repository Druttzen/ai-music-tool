/**
 * Studio mastering in a worker (OfflineAudioContext) so the UI thread stays responsive.
 */

import { renderEnhancedAudioBuffer, audioBufferToWavBlob } from "../lib/audio-enhancer";
import { deserializeAudioBuffer } from "../lib/audio-buffer-serialize";
import { audioBufferToMp3Blob, audioBufferToLosslessWavBlob } from "../lib/audio-export-formats";
import {
  measureIntegratedLoudness,
  STREAMING_TARGET_LUFS,
} from "../lib/lufs-meter";

/** @param {MessageEvent} ev */
self.onmessage = async (ev) => {
  const { id, payload, format } = ev.data;
  try {
    self.postMessage({ id, type: "progress", phase: "mastering", pct: 10 });
    const ctx = new OfflineAudioContext(2, 1, payload.sampleRate);
    const source = deserializeAudioBuffer(ctx, payload);
    self.postMessage({ id, type: "progress", phase: "mastering", pct: 35 });
    const enhanced = await renderEnhancedAudioBuffer(source, ev.data.presetId);
    let afterLufs;
    if (ev.data.presetId === "streaming") {
      const m = await measureIntegratedLoudness(enhanced);
      afterLufs = m.integratedLUFS;
    }
    self.postMessage({ id, type: "progress", phase: "encoding", pct: 75 });
    let blob;
    if (format === "mp3") blob = await audioBufferToMp3Blob(enhanced);
    else if (format === "flac") blob = audioBufferToLosslessWavBlob(enhanced);
    else blob = audioBufferToWavBlob(enhanced);

    const arrayBuffer = await blob.arrayBuffer();
    self.postMessage(
      {
        id,
        type: "done",
        blobBuffer: arrayBuffer,
        mime: blob.type,
        fileName: ev.data.fileName,
        pct: 100,
        afterLufs,
        targetLufs: ev.data.presetId === "streaming" ? STREAMING_TARGET_LUFS : undefined,
      },
      [arrayBuffer],
    );
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      message: err instanceof Error ? err.message : "Export failed",
    });
  }
};
