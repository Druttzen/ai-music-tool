import { describe, it, expect } from "vitest";
import { audioBufferToWav24Blob } from "../app/lib/audio-enhancer.js";

/** Minimal AudioBuffer stub for node tests. */
function makeBuffer(channels, length, sampleRate) {
  const channelData = Array.from({ length: channels }, () => new Float32Array(length));
  channelData[0].set([0, 0.25, -0.25, 0.5, -0.5, 0.1, -0.1, 0]);
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: (i) => channelData[i],
  };
}

describe("audioBufferToWav24Blob", () => {
  it("writes 24-bit PCM fmt chunk", async () => {
    const blob = audioBufferToWav24Blob(makeBuffer(1, 8, 44100));
    const view = new DataView(await blob.arrayBuffer());

    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe(
      "RIFF",
    );
    expect(view.getUint16(34, true)).toBe(24);
    expect(blob.type).toBe("audio/wav");
  });
});
