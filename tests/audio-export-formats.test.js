import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeStudioExportFormat } from "../app/lib/audio-export-formats.js";

describe("normalizeStudioExportFormat", () => {
  it("accepts wav and mp3", () => {
    expect(normalizeStudioExportFormat("wav")).toBe("wav");
    expect(normalizeStudioExportFormat("mp3")).toBe("mp3");
  });

  it("maps lossless aliases to real flac", () => {
    expect(normalizeStudioExportFormat("flac")).toBe("flac");
    expect(normalizeStudioExportFormat("wav-lossless")).toBe("flac");
    expect(normalizeStudioExportFormat("lossless")).toBe("flac");
  });

  it("accepts wav24 and wav32", () => {
    expect(normalizeStudioExportFormat("wav24")).toBe("wav24");
    expect(normalizeStudioExportFormat("24bit")).toBe("wav24");
    expect(normalizeStudioExportFormat("wav32")).toBe("wav32");
    expect(normalizeStudioExportFormat("float")).toBe("wav32");
  });

  it("maps apple delivery aliases to m4a", () => {
    expect(normalizeStudioExportFormat("m4a")).toBe("m4a");
    expect(normalizeStudioExportFormat("aac")).toBe("m4a");
    expect(normalizeStudioExportFormat("apple")).toBe("m4a");
  });

  it("rejects ALAC/CAF as export formats (decode-only)", () => {
    expect(() => normalizeStudioExportFormat("alac")).toThrow(/decode-only/i);
    expect(() => normalizeStudioExportFormat("caf")).toThrow(/decode-only/i);
  });

  it("defaults unknown values to wav", () => {
    expect(normalizeStudioExportFormat(undefined)).toBe("wav");
    expect(normalizeStudioExportFormat("ogg")).toBe("wav");
  });
});

describe("downloadAudioBufferAsFormat browser fallbacks", () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let downloadSpy;

  beforeEach(() => {
    vi.resetModules();
    downloadSpy = vi.fn();
    vi.doMock("../app/lib/audio-enhancer.js", async () => {
      const actual = await vi.importActual("../app/lib/audio-enhancer.js");
      return {
        ...actual,
        downloadAudioBlob: downloadSpy,
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("../app/lib/audio-enhancer.js");
    vi.doUnmock("lamejs");
  });

  function makeBuffer(channels = 1, length = 8, sampleRate = 44100) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length));
    channelData[0].set([0, 0.25, -0.25, 0.5, -0.5, 0.1, -0.1, 0]);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (i) => channelData[Math.min(i, channels - 1)],
    };
  }

  it("falls back FLAC → WAV24 with formatFallback", async () => {
    const { downloadAudioBufferAsFormat } = await import("../app/lib/audio-export-formats.js");
    const result = await downloadAudioBufferAsFormat(makeBuffer(), "flac", "song");
    expect(result).toEqual({ format: "wav24", formatFallback: true });
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadSpy.mock.calls[0];
    expect(name).toBe("song-24bit.wav");
    expect(blob.type).toBe("audio/wav");
  });

  it("falls back M4A → MP3 with formatFallback", async () => {
    vi.resetModules();
    downloadSpy = vi.fn();
    vi.doMock("../app/lib/audio-enhancer.js", async () => {
      const actual = await vi.importActual("../app/lib/audio-enhancer.js");
      return {
        ...actual,
        downloadAudioBlob: downloadSpy,
      };
    });
    // lamejs needs MPEGMode in Node vitest; provide a minimal encoder stub.
    vi.doMock("lamejs", () => {
      globalThis.MPEGMode = { STEREO: 0, JOINT_STEREO: 1, DUAL_CHANNEL: 2, MONO: 3 };
      return {
        Mp3Encoder: class {
          encodeBuffer() {
            return new Int8Array([0xff, 0xfb, 0x10]);
          }
          flush() {
            return new Int8Array([0x00]);
          }
        },
      };
    });
    const { downloadAudioBufferAsFormat } = await import("../app/lib/audio-export-formats.js");
    const result = await downloadAudioBufferAsFormat(makeBuffer(), "m4a", "song");
    expect(result).toEqual({ format: "mp3", formatFallback: true });
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadSpy.mock.calls[0];
    expect(name).toBe("song.mp3");
    expect(blob.type).toBe("audio/mpeg");
  });
});
