import { beforeAll, describe, expect, it } from "vitest";
import { buildMusicGenAnalysisReport } from "../app/lib/musicgen-preview.js";

beforeAll(() => {
  class MockAudioContext {
    constructor() {
      this.sampleRate = 8000;
    }
    async decodeAudioData(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      const sampleRate = view.getUint32(24, true) || 8000;
      const dataSize = view.getUint32(40, true) || 1600;
      const length = Math.max(1, Math.floor(dataSize / 2));
      const channel = new Float32Array(length);
      return {
        duration: length / sampleRate,
        sampleRate,
        getChannelData: () => channel,
      };
    }
    async close() {}
  }
  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;
});

function makeSilentWavBlob(durationSec = 0.25, sampleRate = 8000) {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  return new Blob([buffer], { type: "audio/wav" });
}

describe("buildMusicGenAnalysisReport", () => {
  it("tags a generated WAV with MusicGen metadata and waveform peaks", async () => {
    const blob = makeSilentWavBlob();
    const report = await buildMusicGenAnalysisReport(blob, {
      prompt: "dark techno sketch",
      model: "facebook/musicgen-small",
      durationSec: 10,
      fileName: "musicgen-test.wav",
    });

    expect(report.sourceEngine).toBe("musicgen");
    expect(report.musicGenPrompt).toBe("dark techno sketch");
    expect(report.musicGenModel).toBe("facebook/musicgen-small");
    expect(report.musicGenDurationSec).toBe(10);
    expect(report.trackSummary).toMatch(/MusicGen preview/);
    expect(report.waveformPeaks?.length).toBeGreaterThan(0);
    expect(report.fileName).toBe("musicgen-test.wav");
  });

  it("records highlight melody conditioning in metadata", async () => {
    const blob = makeSilentWavBlob();
    const report = await buildMusicGenAnalysisReport(blob, {
      prompt: "loop",
      mode: "melody",
      highlightMelody: true,
    });
    expect(report.musicGenHighlightMelody).toBe(true);
    expect(report.trackSummary).toMatch(/highlight melody/i);
  });
});
