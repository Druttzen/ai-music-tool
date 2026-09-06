import { describe, it, expect } from "vitest";
import { audioBufferToWav24Blob, STUDIO_EXPORT_PRESETS } from "../app/lib/audio-enhancer.js";
import { targetLufsForPreset } from "../app/lib/lufs-meter.js";

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

describe("STUDIO_EXPORT_PRESETS loudness targets", () => {
  it("exposes podcast −16, broadcast −23, and measure-only", () => {
    const ids = STUDIO_EXPORT_PRESETS.map((p) => p.id);
    expect(ids).toContain("podcast");
    expect(ids).toContain("broadcast");
    expect(ids).toContain("measure");
    expect(targetLufsForPreset("podcast")).toBe(-16);
    expect(targetLufsForPreset("broadcast")).toBe(-23);
    expect(targetLufsForPreset("measure")).toBeUndefined();
    expect(STUDIO_EXPORT_PRESETS.find((p) => p.id === "podcast")?.targetLufs).toBe(-16);
  });
});
